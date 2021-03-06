// ERPNext - web based ERP (http://erpnext.com)
// Copyright (C) 2012 Web Notes Technologies Pvt Ltd
// 
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
// 
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
// 
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

wn.require("app/js/stock_analytics.js");

wn.pages['stock-balance'].onload = function(wrapper) { 
	wn.ui.make_app_page({
		parent: wrapper,
		title: 'Stock Balance',
		single_column: true
	});
	
	new erpnext.StockBalance(wrapper);
	
	wrapper.appframe.add_home_breadcrumb()
	wrapper.appframe.add_module_breadcrumb("Stock")
	wrapper.appframe.add_breadcrumb("icon-bar-chart")
}

erpnext.StockBalance = erpnext.StockAnalytics.extend({
	init: function(wrapper) {
		this._super(wrapper, {
			title: "Stock Balance",
			doctypes: ["Item", "Item Group", "Warehouse", "Stock Ledger Entry", "Brand",
				"Stock Entry"],
		});
	},
	setup_columns: function() {
		this.columns = [
			{id: "name", name: "Item", field: "name", width: 300,
				formatter: this.tree_formatter},
			{id: "opening", name: "Opening", field: "opening", width: 100, 
				formatter: this.currency_formatter},
			{id: "inflow", name: "In", field: "inflow", width: 100, 
				formatter: this.currency_formatter},
			{id: "outflow", name: "Out", field: "outflow", width: 100, 
				formatter: this.currency_formatter},
			{id: "closing", name: "Closing", field: "closing", width: 100, 
				formatter: this.currency_formatter},
			{id: "brand", name: "Brand", field: "brand", width: 100},
			{id: "item_name", name: "Item Name", field: "item_name", width: 100},
			{id: "description", name: "Description", field: "description", width: 200, 
				formatter: this.text_formatter},
		];
	},
	
	filters: [
		{fieldtype:"Select", label: "Value or Qty", options:["Value (Weighted Average)", 
			"Value (FIFO)", "Quantity"],
			filter: function(val, item, opts, me) {
				return me.apply_zero_filter(val, item, opts, me);
			}},
		{fieldtype:"Select", label: "Brand", link:"Brand", 
			default_value: "Select Brand...", filter: function(val, item, opts) {
				return val == opts.default_value || item.brand == val || item._show;
			}, link_formatter: {filter_input: "brand"}},
		{fieldtype:"Select", label: "Warehouse", link:"Warehouse", 
			default_value: "Select Warehouse..."},
		{fieldtype:"Date", label: "From Date"},
		{fieldtype:"Label", label: "To"},
		{fieldtype:"Date", label: "To Date"},
		{fieldtype:"Button", label: "Refresh", icon:"icon-refresh icon-white", cssClass:"btn-info"},
		{fieldtype:"Button", label: "Reset Filters"}
	],
	
	setup_plot_check: function() {
		return;
	},
	
	prepare_data: function() {
		this.stock_entry_map = this.make_name_map(wn.report_dump.data["Stock Entry"], "name");
		this._super();
	},
	
	prepare_balances: function() {
		var me = this;
		var from_date = dateutil.str_to_obj(this.from_date);
		var to_date = dateutil.str_to_obj(this.to_date);
		var data = wn.report_dump.data["Stock Ledger Entry"];

		this.item_warehouse = {};

		for(var i=0, j=data.length; i<j; i++) {
			var sl = data[i];
			sl.posting_datetime = sl.posting_date + " " + sl.posting_time;
			var posting_datetime = dateutil.str_to_obj(sl.posting_datetime);
			
			if(me.is_default("warehouse") ? true : me.warehouse == sl.warehouse) {
				var item = me.item_by_name[sl.item_code];
				
				if(me.value_or_qty!="Quantity") {
					var wh = me.get_item_warehouse(sl.warehouse, sl.item_code);
					var is_fifo = this.value_or_qty== "Value (FIFO)";
					var diff = me.get_value_diff(wh, sl, is_fifo);
				} else {
					var diff = sl.qty;
				}

				if(posting_datetime < from_date) {
					item.opening += diff;
				} else if(posting_datetime <= to_date) {
					var ignore_inflow_outflow = this.is_default("warehouse")
						&& sl.voucher_type=="Stock Entry" 
						&& this.stock_entry_map[sl.voucher_no].purpose=="Material Transfer";
					
					if(!ignore_inflow_outflow) {
						if(diff < 0) {
							item.outflow += Math.abs(diff);
						} else {
							item.inflow += diff;
						}
					}
					
					item.closing += diff;
				} else {
					break;
				}
			}
		}
	},
	
	update_groups: function() {
		var me = this;

		$.each(this.data, function(i, item) {
			// update groups
			if(!item.is_group && me.apply_filter(item, "brand")) {
				var parent = me.parent_map[item.name];
				while(parent) {
					parent_group = me.item_by_name[parent];
					$.each(me.columns, function(c, col) {
						if (col.formatter == me.currency_formatter) {
							parent_group[col.field] = 
								flt(parent_group[col.field])
								+ flt(item[col.field]);
						}
					});
					
					// show parent if filtered by brand
					if(item.brand == me.brand)
						parent_group._show = true;
					
					parent = me.parent_map[parent];
				}
			}
		});
	},
	
	get_plot_data: function() {
		return;
	}
});