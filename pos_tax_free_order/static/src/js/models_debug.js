odoo.define('pos_tax_free_order.models', function (require) {
"use strict";

	var gui = require('point_of_sale.gui');
	var core = require('web.core');
	var screens = require('point_of_sale.screens');
	var models = require('point_of_sale.models');
	var PosBaseWidget = require('point_of_sale.BaseWidget');
	var DiscountBase = require('pos_discount.pos_discount');
	models.load_fields("pos.order", "is_tax_free_order");
	var Model = require('web.Model');
	var newSelf;

    models.load_fields('pos.config',[
                                'ask_password_discount',
                                'password_discount',
                                'ask_fix_password_discount',
                                'fix_password_discount',
                                'ask_price_password_discount',
                                'password_order_discount',
                                'price_password_discount']);

	screens.ReceiptScreenWidget.include({
		click_next: function(){
			this._super();
			this.getParent().$('.order-tax-free').hide();
			this.getParent().$('.order-apply-tax').show();
		    }
	    });
    var ActionTaxFreeApplyTaxWidget = PosBaseWidget.extend({
	    template: 'ActionTaxFreeApplyTaxWidget',
	    renderElement: function() {
	        var self = this;
	        this._super();
	        this.$('.order-tax-free').click(function(){
	        	var pos_order = self.pos.get_order();
                if (pos_order!==null && pos_order!==undefined){
                    $('.order-apply-tax').show();
                    $('.order-tax-free').hide();
                    pos_order.is_tax_free_order=true;
                    var orderlines = pos_order.get_orderlines();
                    if(self.pos.apply_tax_id) {
                        self.pos.apply_tax_id = undefined;
                        }
                    $.each(orderlines,function(index){
                        var line = orderlines[index];
                        line.trigger('change',line);
                        })
                    }
	            });
	        this.$('.order-apply-tax').click(function(){
	        	var pos_order = self.pos.get_order();
	        	self.gui.show_popup('POS_tax_select_widget', {'confirm': function(value) { },
                    });
	        	});
	        var pos_order = self.pos.get_order();
	        if (pos_order!==null && pos_order!==undefined && pos_order.is_tax_free_order){
	        	self.$('.order-apply-tax').show();
	    		self.$('.order-tax-free').hide();
	            }
	        else{
	        	self.$('.order-apply-tax').show();
	    		self.$('.order-tax-free').hide();
	            }
	        }
	    });

	screens.ProductScreenWidget.include({
		start: function(){
			this.taxfreeapply = new ActionTaxFreeApplyTaxWidget(this,{});
	        this.taxfreeapply.replace(this.$('.placeholder-ActionTaxFreeApplyTaxWidget'));
	        this._super();
    		}
	    });

	var _super_order_line = models.Orderline.prototype;
	models.Orderline = models.Orderline.extend({
		get_taxes: function(){
			if (this.order.is_tax_free_order){
				return [];
		    	}
			var taxes = _super_order_line.get_taxes.apply(this,arguments);
			return taxes; //_super_order_line.get_taxes.apply(this,arguments);
		    },
		get_applicable_taxes: function(){
			if (this.order.is_tax_free_order){
				return [];
			    }
			var taxes = _super_order_line.get_applicable_taxes.apply(this,arguments);
			return taxes;
		    },
		compute_all: function(taxes, price_unit, quantity, currency_rounding, no_map_tax){
			if (this.order.is_tax_free_order){
				arguments[0] = []
			    }
			return _super_order_line.compute_all.apply(this,arguments);
		    },
		    get_discount_fixed: function(){
		        return this.get_discount() * this.get_unit_price()/100 * this.get_quantity();
		    },
		get_all_prices: function(){
            if(this.discount_fixed > 0){
                console.log(56);
                let discounted = 0;
                var price_unit = this.get_unit_price() * this.get_quantity() - this.get_discount_fixed();
                }
            else {
                var price_unit = this.get_unit_price() * (1.0 - (this.get_discount() / 100.0));
                }
            var taxtotal = 0;
            var product =  this.get_product();
            var taxes_ids = product.taxes_id;
            if(this.pos.apply_tax_id) {
                taxes_ids = [parseInt(this.pos.apply_tax_id)];
                this.order.is_tax_free_order = false;
                }

            var taxes =  this.pos.taxes;
            var taxdetail = {};
            var product_taxes = [];

            _(taxes_ids).each(function(el){
                product_taxes.push(_.detect(taxes, function(t){
                    return t.id === el;
                    }));
                });

            var all_taxes = this.compute_all(product_taxes, price_unit, this.get_quantity(), this.pos.currency.rounding);
            _(all_taxes.taxes).each(function(tax) {
                taxtotal += tax.amount;
                taxdetail[tax.id] = tax.amount;
                });

            return {
                "priceWithTax": all_taxes.total_included,
                "priceWithoutTax": all_taxes.total_excluded,
                "tax": taxtotal,
                "taxDetails": taxdetail,
                };
            },
	    });

	var _super_order = models.Order.prototype;
	models.Order = models.Order.extend({
		init_from_JSON: function(json) {
			_super_order.init_from_JSON.apply(this,arguments);
			this.is_tax_free_order=json.is_tax_free_order;
		    },
        export_for_printing: function(){
	        var json = _super_order.export_for_printing.apply(this,arguments);
	        json.is_tax_free_order=this.is_tax_free_order;

	        return json;
	        },
	    export_as_JSON: function(){
	        var json = _super_order.export_as_JSON.apply(this,arguments);
	        json.is_tax_free_order = this.is_tax_free_order;

	        return json;
	        },
	    });

var POSTaxFreePassword = PosBaseWidget.extend({
    template: 'POSTaxFreePassword',
    init: function(parent, args) {
        this._super(parent, args);
        this.parameter = "";
        },
    start: function() {
        this._super();
        var self = this;
        this.getParent().on("view_content_has_changed", this, function () {
            self.render_value();
            });
        },
    events: {
        'click .button.cancel':  'click_cancel',
        'click .button.done-select': 'click_confirm',
        },
    show: function(options){
        options = options || {};
        this._super(options);
        this.renderElement();
        this.parameter = options.parameter;
        this.$('.text-free-input-class').focus();
        },
    close: function(){
        if (this.pos.barcode_reader){
            this.pos.barcode_reader.restore_callbacks();
            }
        },
    click_confirm: function() {
        var self = this;
        var mode = this.parameter;
        var pass = $('.text-free-input-class').val();

        if(mode == 'discount' && pass == self.pos.config.password_discount) {
            newSelf.state.changeMode('discount');
            self.pos.gui.close_popup();
            }
        else if(mode == 'price' && pass == self.pos.config.price_password_discount) {
            newSelf.state.changeMode('price');
            self.pos.gui.close_popup();
            }
        else if(mode == 'discount_fixed' && pass == self.pos.config.fix_password_discount) {
            newSelf.state.changeMode('discount_fixed');
            self.pos.gui.close_popup();
            }
        else if(mode == 'order_discount' && pass == self.pos.config.password_order_discount) {
            self.pos.gui.close_popup();
            self.gui.show_popup('discount_widget', {
                value: self.pos.wk_discount_list,
                });
            }
        else {
            $(".tax-free-input-error").show();
            //$(".tax-free-input-error").hide();
            //var pos_order = self.pos.get_order();
            //if (pos_order!==null && pos_order!==undefined){
            //      $('.order-apply-tax').show();
            //      $('.order-tax-free').hide();
            //      pos_order.is_tax_free_order=true;
            //      var orderlines = pos_order.get_orderlines();
            //      if(self.pos.apply_tax_id) {
            //          self.pos.apply_tax_id = undefined;
            //          }
            //      $.each(orderlines,function(index){
            //          var line = orderlines[index];
            //          line.trigger('change',line);
            //          })
            //      }
            //self.pos.gui.close_popup();
            }
        },
    click_cancel: function(){
        this.gui.close_popup();
        },
    });
gui.define_popup({name:'POS_tax_free_password', widget: POSTaxFreePassword});

var POSTaxSelectWidget = PosBaseWidget.extend({
    template: 'SelectApplyTaxWidget',
    init: function(parent, args) {
        this._super(parent, args);
        this.parameter = "";
        },
    start: function() {
        this._super();
        var self = this;
        this.getParent().on("view_content_has_changed", this, function () {
            self.render_value();
            });
        },
    events: {
        'click .button.cancel':  'click_cancel',
        'click .button.done-select': 'click_confirm',
        },
    show: function(options){
        options = options || {};
        this._super(options);
        this.renderElement();
        this.parameter = options.parameter;
        },
    close: function(){
        if (this.pos.barcode_reader){
            this.pos.barcode_reader.restore_callbacks();
            }
        },
    click_confirm: function() {
        var self = this;
        var mode = this.parameter;

        var sel_tax = $("[name='orderline-tax-selected']:checked").val();
        if(sel_tax === undefined) {
            alert("No Tax Class is selected. Please select One");
            }
        else {
            self.pos.apply_tax_id = sel_tax;

			var pos_order = self.pos.get_order();
            if (pos_order!==null && pos_order!==undefined){
                $('.order-apply-tax').hide();
                $('.order-tax-free').show();
                pos_order.is_tax_free_order = false;
                var orderlines = pos_order.get_orderlines();
                $.each(orderlines,function(index){
                    var line = orderlines[index];
                    line.trigger('change',line);
                    })
                }
            this.gui.close_popup();
            }
        },
    click_cancel: function(){
        this.gui.close_popup();
        },
    });
gui.define_popup({name:'POS_tax_select_widget', widget: POSTaxSelectWidget});

screens.NumpadWidget.include({
    clickChangeMode: function(event) {
        var newMode = event.currentTarget.attributes['data-mode'].nodeValue;
        newSelf = this;
        if(newMode=='discount') {
            if(this.pos.config.ask_password_discount){
                this.gui.show_popup('POS_tax_free_password',{
                    'parameter': 'discount',
                    'confirm': function(value) { },
                    });
                }
            else {
                this.state.changeMode('discount');
                }
            }
        else if(newMode=='price') {
            if(this.pos.config.ask_price_password_discount){
                this.gui.show_popup('POS_tax_free_password',{
                    'parameter': 'price',
                    'confirm': function(value) { },
                    });
                }
            else {
                this.state.changeMode('price');
                }
            }
        else if(newMode=='discount_fixed') {
            if(this.pos.config.ask_fix_password_discount){
                this.gui.show_popup('POS_tax_free_password',{
                    'parameter': 'discount_fixed',
                    'confirm': function(value) { },
                    });
                }
            else {
                this.state.changeMode('discount_fixed');
                }
            }
        else {
            return this.state.changeMode(newMode);
            }
        }
	});
});
//# sourceMappingURL=/pos_tax_free_order/static/src/js/models_debug.js