/* Copyright (c) 2016-Present Webkul Software Pvt. Ltd. (<https://webkul.com/>) */
/* See LICENSE file for full copyright and licensing details. */
/* License URL : <https://store.webkul.com/license.html/> */
odoo.define('pos_order_discount.order_discounts', function(require) {
    "use strict";

    var models = require('point_of_sale.models');
    var screens = require('point_of_sale.screens');
    var gui = require('point_of_sale.gui');
    var PopupWidget = require("point_of_sale.popups");
    var round_pr = require('web.utils').round_precision;
    var PaymentScreenWidget = screens.PaymentScreenWidget;
    
    var _t = require('web.core')._t;

    models.load_fields('pos.config',['ask_password_order_discount']);
    models.load_models([{
        model: 'pos.order.discount',
        fields: ['name', 'discount_method', 'discount_type', 'id', 'short_description', 'discount_on'],
        domain: function(self) {
            return [
                ['id', 'in', self.config.wk_discounts]
            ];
        },
        loaded: function(self, wk_pos_discount) {
            self.wk_pos_discount = wk_pos_discount;
        },
    }, ], {
        'after': 'product.product'
    });

    var PaymentScreenWidget = screens.PaymentScreenWidget;
    PaymentScreenWidget.include({
        renderElement: function() {
            var self = this;
            this._super();
            this.$('.js_discounts').click(function() {
                var wk_discount_list = self.pos.wk_pos_discount;
                var discount_prodcut_id = self.pos.config.wk_discount_product_id;
                if (!discount_prodcut_id) {
                    self.gui.show_popup('error', {
                        'title': _t("Warning !!!!"),
                        'body': _t("You have not choosen any Discount product. Please choose Discount Product in corresponding POS Session"),
                        });
                    }
                else if (wk_discount_list.length >= 1) {
                    if(self.pos.config.ask_password_order_discount){
                        self.pos.wk_discount_list = wk_discount_list;
                        self.gui.show_popup('POS_tax_free_password', {
                            'parameter': 'order_discount',
                            'confirm': function(value) { },
                            });
                        }
                    else {
                        self.gui.show_popup('discount_widget', {
                            value: self.pos.wk_discount_list,
                            });
                        }
                    }
                else {
                    self.gui.show_popup('error', {
                        'title': _t("Warning !!!!"),
                        'body': _t("You have not choosen any Discount. Please choose Discount in corresponding POS Session"),
                        });
                    }
                });
            },
        render_paymentlines: function() {
            var self = this;
            this._super();
            $(".paymentlines-container").on('click', '.wk_discount_block', function() {
                var wkcurrentOrder = self.pos.get('selectedOrder');
                wkcurrentOrder.set_discountLine(undefined);
                wkcurrentOrder.wk_set_discount(undefined);
                wkcurrentOrder.wk_set_discount_info(undefined);
                self.gui.show_screen('payment', {}, 'refresh');
                $(".paymentlines-container").undelegate()
            });
        }
    });

    var DiscountPopupWidget = PopupWidget.extend({
        template: 'DiscountPopupWidget',
        get_discount_image_url: function(discount_id) {
            return window.location.origin + '/web/binary/image?model=pos.order.discount&field=file&id=' + discount_id;
            },
        renderElement: function() {
            var self = this;
            this._super();
            var discount_prodcut_id = self.pos.config.wk_discount_product_id;
            var wk_discount_list = self.pos.wk_pos_discount;
            var wk_discount = 0;
            var discount_price = 0;
            var currentOrder = self.pos.get('selectedOrder');
            var discount_offer = 0;
            $("a", this.$el).click(function(e) {
                var discount_id = parseInt($(this).attr('id'));
                for (var i = 0; i < wk_discount_list.length; i++) {
                    if (wk_discount_list[i].id == discount_id) {
                        wk_discount = wk_discount_list[i];
                        break;
                        }
                    }
                if (wk_discount.discount_on == 'tax_inclusive') {
                    discount_offer = currentOrder.get_total_with_tax();
                    }
                else {
                    discount_offer = currentOrder.get_total_without_tax();
                    }
                if (wk_discount.discount_type == 'percent') {
                    discount_price = (discount_offer / 100) * wk_discount.discount_method;
                    }
                else {
                    if (wk_discount.discount_method > discount_offer)
                        discount_price = discount_offer;
                    else
                        discount_price = wk_discount.discount_method;
                    }
                self.pos.get('selectedOrder').wk_set_discount_info({
                    "discount_type": wk_discount.discount_type,
                    "discount_value": wk_discount.discount_method,
                    "discount_name": wk_discount.name
                    });
                self.pos.get('selectedOrder').set_discountLine({
                    'price': discount_price,
                    'id': discount_prodcut_id[0]
                    });
                currentOrder.wk_set_discount(discount_price);
                self.gui.show_screen('payment', {}, 'refresh');
                });

            $(".set-discount", this.$el).click(function(e) {
                var disc_val = parseFloat($("[name='hama_input_discount_amount']").val());
                if(disc_val == "") {
                    alert("Discount Value is set empty. Please correct it")
                    return;
                    }
                currentOrder = self.pos.get('selectedOrder');

                discount_offer = currentOrder.get_total_with_tax();
                if (disc_val > discount_offer) {
                    discount_price = discount_offer;
                    }
                else {
                    discount_price = disc_val;
                    }

                self.pos.get('selectedOrder').wk_set_discount_info({
                    "discount_type": 'amount',
                    "discount_value": disc_val,
                    "discount_name": "Discount"
                    });
                self.pos.get('selectedOrder').set_discountLine({
                    'price': parseFloat(disc_val),
                    'id': discount_prodcut_id[0]
                    });
                currentOrder.wk_set_discount(discount_price);
                self.gui.show_screen('payment', {}, 'refresh');

                if ($("#pos-rounding").hasClass('fa-toggle-on')){
                    //$("#pos-rounding").trigger('click');
                    //$("#pos-rounding").trigger('click');
                    }
                else{
                    //$("#pos-rounding").trigger('click');
                    }
                });
            },
        });
    gui.define_popup({name: 'discount_widget', widget: DiscountPopupWidget});

    var _super = models.Order;
    models.Order = models.Order.extend({
        get_total_paid: function() {
            var disoucnt_fun = this.wk_get_discount();
            return round_pr(this.paymentlines.reduce((function(sum, paymentLine) {
                return sum + paymentLine.get_amount();
            }), 0), this.pos.currency.rounding) + disoucnt_fun;
        },
        wk_get_change: function(paymentline) {
            var disoucnt_fun = this.wk_get_discount();
            if (!paymentline) {
                var change = this.get_total_paid() + disoucnt_fun;
            } else {
                var change = -this.get_total_with_tax() + disoucnt_fun;
                var lines = this.paymentlines.models;
                for (var i = 0; i < lines.length; i++) {
                    change += lines[i].get_amount();
                    if (lines[i] === paymentline) {
                        break;
                    }
                }
            }
            return round_pr(Math.max(0, change), this.pos.currency.rounding);
        },
        set_discountLine: function(discount) {
            if (discount != undefined) {
                this.set('discountLine', [
                    [0, 0, {
                        'discount': 0,
                        'price_unit': -discount['price'],
                        'product_id': discount['id'],
                        'qty': 1
                    }]
                ]);
            } else {
                this.set('discountLine', undefined);
            }
        },
        wk_set_discount: function(discount) {
            if (discount != undefined) {
                this.set('wkdiscounPrice', discount);
            } else {
                this.set('wkdiscounPrice', undefined);
            }
        },
        get_discountLine: function() {
            return this.get('discountLine');
        },
        wk_get_discount: function() {
            if (this.get('wkdiscounPrice') == undefined) {
                return 0;
            } else {
                return this.get('wkdiscounPrice');
            }
        },
        export_as_JSON: function() {
            var currentOrder = this.pos.get('selectedOrder');
            var json = _super.prototype.export_as_JSON.apply(this, arguments);
            json.discountLine = this.get_discountLine();
            return json;
        },
        wk_set_discount_info: function(discount_info) {
            if (discount_info != undefined) {
                this.set('wkdiscount_info', discount_info);
            } else {
                this.set('wkdiscount_info', undefined);
            }
        },
        wk_get_discount_info: function() {
            var wkdiscount_info = this.get('wkdiscount_info')
            if (wkdiscount_info == undefined) {
                return "";
            } else {
                if (wkdiscount_info.discount_type == 'percent') {
                    return "(" + wkdiscount_info.discount_name + " " + wkdiscount_info.discount_value + " %)";

                } else {
                    return "(" + wkdiscount_info.discount_name + " " + wkdiscount_info.discount_value + " Amount)";
                }
            }
        },
    });
});