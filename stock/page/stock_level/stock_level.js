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

wn.pages['stock-level'].onload = function(wrapper) { 
	wn.ui.make_app_page({
		parent: wrapper,
		title: 'Stock Level',
		single_column: true
	});
	
	new erpnext.StockLevel(wrapper);

	wrapper.appframe.add_home_breadcrumb()
	wrapper.appframe.add_module_breadcrumb("Stock")
	wrapper.appframe.add_breadcrumb("icon-bar-chart");
}

wn.require("app/js/stock_grid_report.js");

erpnext.StockLevel = erpnext.StockGridReport.extend({
	init: function(wrapper) {
		var me = this;
		
		this._super({
			title: "Stock Level",
			page: wrapper,
			parent: $(wrapper).find('.layout-main'),
			appframe: wrapper.appframe,
			doctypes: ["Item", "Warehouse", "Stock Ledger Entry", "Production Order", 
				"Purchase Request Item", "Purchase Order Item", "Sales Order Item", "Brand"],
		});
		
		this.wrapper.bind("make", function() {
			wn.utils.set_footnote(me, me.wrapper.get(0),
				"<ul> \
					<li style='font-weight: bold;'> \
						Projected Qty = Actual Qty + Planned Qty + Requested Qty \
						+ Ordered Qty - Reserved Qty </li> \
					<ul> \
						<li>Actual Qty: Quantity available in the warehouse. </li> \
						<li>Planned Qty: Quantity, for which, Production Order has been raised, \
							but is pending to be manufactured. </li> \
						<li>Requested Qty: Quantity requested for purchase, but not ordered. </li> \
						<li>Ordered Qty: Quantity ordered for purchase, but not received.</li> \
						<li>Reserved Qty: Quantity ordered for sale, but not delivered. </li> \
					</ul> \
				</ul>");
		});
	},
	
	setup_columns: function() {
		this.columns = [
			{id: "item_code", name: "Item Code", field: "item_code", width: 160, 	
				link_formatter: {
					filter_input: "item_code",
					open_btn: true,
					doctype: '"Item"',
				}},
			{id: "warehouse", name: "Warehouse", field: "warehouse", width: 100,
				link_formatter: {filter_input: "warehouse"}},
			{id: "actual_qty", name: "Actual Qty", 
				field: "actual_qty", width: 80, formatter: this.currency_formatter},
			{id: "planned_qty", name: "Planned Qty", 
				field: "planned_qty", width: 80, formatter: this.currency_formatter},
			{id: "requested_qty", name: "Requested Qty", 
				field: "requested_qty", width: 80, formatter: this.currency_formatter},
			{id: "ordered_qty", name: "Ordered Qty", 
				field: "ordered_qty", width: 80, formatter: this.currency_formatter},
			{id: "reserved_qty", name: "Reserved Qty", 
				field: "reserved_qty", width: 80, formatter: this.currency_formatter},
			{id: "projected_qty", name: "Projected Qty", 
				field: "projected_qty", width: 80, formatter: this.currency_formatter},
			{id: "uom", name: "UOM", field: "uom", width: 60},
			{id: "brand", name: "Brand", field: "brand", width: 100,
				link_formatter: {filter_input: "brand"}},
			{id: "item_name", name: "Item Name", field: "item_name", width: 100,
				formatter: this.text_formatter},
			{id: "description", name: "Description", field: "description", width: 200, 
				formatter: this.text_formatter},
		];
	},
	
	filters: [
		{fieldtype:"Select", label: "Item Code", link:"Item", default_value: "Select Item...",
			filter: function(val, item, opts) {
				return item.item_code == val || val == opts.default_value;
			}},
			
		{fieldtype:"Select", label: "Warehouse", link:"Warehouse", 
			default_value: "Select Warehouse...", filter: function(val, item, opts) {
				return item.warehouse == val || val == opts.default_value;
			}},
		
		{fieldtype:"Select", label: "Brand", link:"Brand", 
			default_value: "Select Brand...", filter: function(val, item, opts) {
				return val == opts.default_value || item.brand == val;
			}},
		{fieldtype:"Button", label: "Refresh", icon:"icon-refresh icon-white", cssClass:"btn-info"},
		{fieldtype:"Button", label: "Reset Filters"}
	],
	
	setup_filters: function() {
		var me = this;
		this._super();
		
		this.wrapper.bind("apply_filters_from_route", function() { me.toggle_enable_brand(); });
		this.filter_inputs.item_code.change(function() { me.toggle_enable_brand(); });
		
		this.trigger_refresh_on_change(["item_code", "warehouse", "brand"]);
	},
	
	toggle_enable_brand: function() {
		if(this.filter_inputs.item_code.val() ==
				this.filter_inputs.item_code.get(0).opts.default_value) {
			this.filter_inputs.brand.removeAttr("disabled");
		} else {
			this.filter_inputs.brand
				.val(this.filter_inputs.brand.get(0).opts.default_value)
				.attr("disabled", "disabled");
		}
	},
	
	init_filter_values: function() {
		this._super();
		this.filter_inputs.warehouse.get(0).selectedIndex = 0;
	},
	
	prepare_data: function() {
		var me = this;

		if(!this._data) {
			this._data = [];
			this.item_warehouse_map = [];
			this.item_by_name = this.make_name_map(wn.report_dump.data["Item"]);
			var sorted_item_list = Object.keys(this.item_by_name).sort();
			$.each(sorted_item_list, function(i, item_code) {
				var item = me.item_by_name[item_code];
				$.each(wn.report_dump.data["Warehouse"], function(i, warehouse) {
					// a list of item warehouse combination objects
					var row = {
						item_code: item_code,
						warehouse: warehouse.name,
						brand: item.brand,
						item_name: item.item_name || item.name,
						uom: item.stock_uom,
						id: item_code + ":" + warehouse.name,
					}
					me.reset_item_values(row);
					me._data.push(row);
					me.item_warehouse_map[row.id] = row;
				});
			});
			this.calculate_quantities();
			
			// filter out rows with zero values
			this._data = $.map(this._data, function(d) {
				return me.apply_zero_filter(null, d, null, me) ? d : null;
			});
		}
		
		this.data = [].concat(this._data);
		this.data = $.map(this.data, function(d) {
			return me.apply_filters(d) ? d : null;
		});

		this.calculate_total();
	},
	
	calculate_quantities: function() {
		var me = this;
		$.each([
			["Stock Ledger Entry", "actual_qty"], 
			["Production Order", "planned_qty"], 
			["Purchase Request Item", "requested_qty"],
			["Purchase Order Item", "ordered_qty"],
			["Sales Order Item", "reserved_qty"]], 
			function(i, v) {
				$.each(wn.report_dump.data[v[0]], function(i, item) {
					var row = me.item_warehouse_map[item.item_code + ":" + item.warehouse];
					row[v[1]] += flt(item.qty);
				});
			}
		);
		
		$.each(this._data, function(i, row) {
			row.projected_qty = row.actual_qty + row.planned_qty + row.requested_qty
				+ row.ordered_qty - row.reserved_qty;
		});
	},
	
	calculate_total: function() {
		var me = this;
		// show total if a specific item is selected and warehouse is not filtered
		if(this.is_default("warehouse") && !this.is_default("item_code")) {
			var total = {
				id: "_total",
				item_code: "Total",
				_style: "font-weight: bold",
				_show: true
			};
			this.reset_item_values(total);
			
			$.each(this.data, function(i, row) {
				$.each(me.columns, function(i, col) {
					if (col.formatter==me.currency_formatter) {
						total[col.id] += row[col.id];
					}
				});
			});
			
			this.data = this.data.concat([total]);
		}
	}
})
