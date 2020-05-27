odoo.define('mai_pos_roundoff_amount.pos', function (require) {
"use strict";

var gui = require('point_of_sale.gui');
var screens = require('point_of_sale.screens');
var PopupWidget = require('point_of_sale.popups');
var core = require('web.core');
var models = require('point_of_sale.models')
var utils = require('web.utils');

var QWeb = core.qweb;
var round_pr = utils.round_precision;
var round_di = utils.round_decimals;

    function decimalAdjust(value){
        var split_value = value.toFixed(2).split('.');
        //convert string value to integer
        for(var i=0; i < split_value.length; i++){
            split_value[i] = parseInt(split_value[i]);
        }
        var reminder_value = split_value[1] % 10;
        var division_value = parseInt(split_value[1] / 10);
        var rounding_value;
        var nagative_sign = false;
        if(split_value[0] == 0 && value < 0){
            nagative_sign = true;
        }
        if(_.contains(_.range(0,5), reminder_value)){
            rounding_value = eval(split_value[0].toString() + '.' + division_value.toString() + '0' )
        }else if(_.contains(_.range(5,10), reminder_value)){
            rounding_value = eval(split_value[0].toString() + '.' + division_value.toString() + '5' )
        }
        if(nagative_sign){
            return -rounding_value;
        }else{
            return rounding_value;
        }
    }

    screens.PaymentScreenWidget.include({
        render_paymentlines: function() {
            var self  = this;
            var order = this.pos.get_order();
            if (!order) {
                return;
            }

            var lines = order.get_paymentlines();
            var due   = order.get_due();
            var extradue = 0;
            if (due && lines.length  && due !== order.get_due(lines[lines.length-1])) {
                extradue = due;
            }

            this.$('.paymentlines-container').empty();
            var lines = $(QWeb.render('PaymentScreen-Paymentlines', { 
                widget: this, 
                order: order,
                paymentlines: lines,
                extradue: extradue,
            }));

            lines.on('click','.delete-button',function(){
                self.click_delete_paymentline($(this).data('cid'));
            });

            lines.on('click','.paymentline',function(){
                self.click_paymentline($(this).data('cid'));
            });

            lines.on('click','#pos-rounding',function(){
                self.toggle_rounding_button();
            });

            lines.appendTo(this.$('.paymentlines-container'));
        },
        toggle_rounding_button: function(){
            var self = this;
            var order = this.pos.get_order();
            var $rounding_elem = $('#pos-rounding');
            if($rounding_elem.hasClass('fa-toggle-off')){
                $rounding_elem.removeClass('fa-toggle-off');
                $rounding_elem.addClass('fa-toggle-on');
                order.set_rounding_status(true);
            } else if($rounding_elem.hasClass('fa-toggle-on')){
                $rounding_elem.removeClass('fa-toggle-on');
                $rounding_elem.addClass('fa-toggle-off');
                order.set_rounding_status(false);
            }
            this.render_paymentlines();
        },
    });

    var _super_Order = models.Order.prototype;
    models.Order = models.Order.extend({
        set_rounding_status: function(rounding_status) {
            this.rounding_status = rounding_status
        },
        get_rounding_status: function() {
            return this.rounding_status;
        },
        get_change: function(paymentline) {
            if (!paymentline) {
//              var change = this.get_total_paid() - this.get_total_with_tax();
                var change = this.get_total_paid() - this.getNetTotalTaxIncluded();
            } else {
                var change = -this.getNetTotalTaxIncluded();
                var lines  = this.paymentlines.models;
                for (var i = 0; i < lines.length; i++) {
                    change += lines[i].get_amount();
                    if (lines[i] === paymentline) {
                        break;
                    }
                }
            }
            return round_pr(Math.max(0,change), this.pos.currency.rounding);
        },
        getNetTotalTaxIncluded: function() {
            var total = this.get_total_with_tax();
            if(this.get_rounding_status()){
                if(this.pos.config.enable_rounding && this.pos.config.rounding_options == 'digits'){
                    var value = round_pr(Math.max(0,total))//decimalAdjust(total);
                    return value;
                }else if(this.pos.config.enable_rounding && this.pos.config.rounding_options == 'points'){
                    var total = this.get_total_without_tax() + this.get_total_tax();
                    var value = decimalAdjust(total);
                    return value;
                }
            }else {
                return total
            }
        },
        get_rounding : function(){
            if(this.get_rounding_status()){
                var total = this ? this.get_total_with_tax() : 0;
                var rounding = this ? this.getNetTotalTaxIncluded() - total: 0;
                return rounding;
            }
        },
        get_due: function(paymentline) {
            if (!paymentline) {
//                var due = this.getNetTotalTaxIncluded() - this.get_total_paid();
//				if(this.wk_get_discount() != 0){
//                    //due = due - this.wk_get_discount();
//                    }
            } else {
                var due = this.getNetTotalTaxIncluded();
                var lines = this.paymentlines.models;
                for (var i = 0; i < lines.length; i++) {
                    if (lines[i] === paymentline) {
                        break;
                    } else {
                        due -= lines[i].get_amount();
                    }
                }
            }
            return round_pr(Math.max(0,due), this.pos.currency.rounding);
        },
        export_as_JSON: function() {
            var self = this;
            var new_val = {};
            var orders = _super_Order.export_as_JSON.call(this);
            new_val = {
                rounding: this.get_rounding(),
                is_rounding: this.pos.config.enable_rounding,
                rounding_option: this.pos.config.enable_rounding ? this.pos.config.rounding_options : false,
            }
            $.extend(orders, new_val);
            return orders;
        },
    });
});