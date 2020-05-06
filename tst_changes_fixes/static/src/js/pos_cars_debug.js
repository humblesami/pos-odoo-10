odoo.define('pos_partner_cars',function(require) {
    "use strict";
    var core = require('web.core');
    var QWeb = core.qweb;

    let tst_car_changes = require('pos_product_creation');
    let carCustomerSearchWidget = tst_car_changes.carCustomerSearchWidget;
    let carReadingWidget = tst_car_changes.carReadingWidget;
    let paymentScreenWidget = tst_car_changes.PaymentScreenWidget;

    carReadingWidget.include({
        init: function(parent, args) {
            this._super(parent, args);
            this.current_car = undefined;
            this.vehicle_no = '';
        },
        show: function(options){
            this._super(options);
            this.current_car = options.current_car;
            this.vehicle_no = options.vehicle_no;
        }
    });

    carCustomerSearchWidget.include({
        init: function(parent, args) {
            this._super(parent, args);

            this.current_page = 0;
            this.page_count = 0;
            this.search_count = 0;
            this.total_count = 0;
            $('body').on('focus', '.input-search-car', function(ev) {
                setTimeout(function() {
                    ev.target.select();
                }, 500);
            });
            console.log(434343);
        },
        show: function(options){
            this._super(options);
            this.total_count = options.usr_cars.length;
            this.search_count = this.total_count;
            this.current_page = 1;
            this.pagingLastShowCar = 0;
            this.page_count = parseInt(this.search_count / this.pagingShowCarJumpCount) + 1;

            let search_input = $('.input-search-car');
            setTimeout(function() {
                if (options.car_id) {
                    search_input.val(options.current_car_id.vehicle_no);
                    search_input.focus();
                }
            }, 1000);
        },
        set_page_offset: function(){
            let start_index = (this.current_page - 1) * this.pagingShowCarJumpCount;
            let end_index_excluded = this.current_page * this.pagingShowCarJumpCount;
            if (end_index_excluded > arr.length) {
                end_index_excluded = arr.length;
            }
            this.pagingLastShowCar = start_index;
            this.pagingNextShowCar = end_index_excluded;
        },
        renderCarsTableList: function(s_type, arr) {
            if(Array.isArray(arr))
            {
                this.set_page_offset(arr);
            }
            else{
                this.pagingLastShowCar = 0;
                this.pagingNextShowCar = this.search_count;
            }
            console.log(this.pagingLastShowCar, this.pagingNextShowCar);
            let res = this._super(s_type, arr);
            return res;
        },
        last_paging: function(e) {
            let self = this;
            if (self.current_page <= 1) {
                return;
            }
            self.current_page -= 1;
            var car_list_widget;
            if (this.isSearch) {
                car_list_widget = this.renderCarsTableList('server', this.searchResult);
            } else {
                car_list_widget = this.renderCarsTableList('', '');
            }
            if (car_list_widget != 'n') {
                this.$('.client-cars-list tbody').html('');
                car_list_widget.appendTo(this.$('.client-cars-list tbody'));
            }
            $('.pages .current_page:first').html(self.current_page);
        },
        next_paging: function(e) {
            let self = this;
            if (self.current_page >= self.page_count) {
                return;
            }
            self.current_page += 1;

            var car_list_widget;
            if (this.isSearch == true) {
                car_list_widget = this.renderCarsTableList('server', this.searchResult);
            } else {
                car_list_widget = this.renderCarsTableList('', '');
            }
            if (car_list_widget != 'n') {
                this.$('.client-cars-list tbody').html('');
                car_list_widget.appendTo(this.$('.client-cars-list tbody'));
            }
            $('.pages .current_page:first').html(self.current_page);
        },
        clear_search_string: function() {
            var self = this;
            self.isSearch = false;
            self.search_count = self.total_count;
            self.current_page = 1;
            self.page_count = parseInt(self.search_count / self.pagingShowCarJumpCount) + 1;

            $(".clear-search-result").hide();
            $(".input-search-car").val('');
            var car_list_widget = self.renderCarsTableList('', '');
            if (car_list_widget != 'n') {
                this.$('.client-cars-list tbody').html('');
                car_list_widget.appendTo(this.$('.client-cars-list tbody'));
            }

            $('.pages .current_page:first').html(self.current_page);
            $('.pages .page_count:first').html(self.page_count);
            $('.counts .search_count:first').html(self.search_count);
        },
        search_partner_table:function(e){
            this._super(e);
            self = this;
            self.search_count = results.length;
            self.current_page = 1;
            self.page_count = parseInt(self.search_count / self.pagingShowCarJumpCount) + 1;
            $('.pages .current_page:first').html(self.current_page);
            $('.pages .page_count:first').html(self.page_count);
            $('.counts .search_count:first').html(self.search_count);
        }
    });

    paymentScreenWidget.include({
        render_readingwidget: function() {
            var self = this;
            let res = self._super();
            let selected_car = undefined;
            let is_car_selected = false;

            let car_on_table_id = undefined;
            if (self.pos.table) {
                car_on_table_id = self.pos.table.currentCar;
                if (car_on_table_id) {
                    car_on_table_id = car_on_table_id.id;
                }
            }
            if (car_on_table_id) {
                for (let ob of self.pos.usr_cars) {
                    if (ob.id == car_on_table_id) {
                        is_car_selected = true;
                        selected_car = ob;
                        break;
                    }
                }
            }
            var methods = $(QWeb.render('TstCarReadingWidget', {
                widget: this,
                selected_car: selected_car
            }));
            methods.find(".customer-next-oil-date").datepicker({
                minDate: 0
            });
            methods.on('click', '.view-car-readings', function() {
                var readings = [];
                if (car_on_table_id && selected_car) {
                    readings = self.pos.cars_readings.filter((el) => {
                        let matching = el.car_id[0] == car_on_table_id;
                        return matching;
                    });
                    selected_car.car_readings = readings;
                }
                self.gui.show_popup('car_reading_widget', {
                    'car_readings': readings,
                    'current_car': selected_car,
                    'car_id': $("select.customer-car-reading-per-day").find(":selected").val(),
                    'car_brand': $("select.customer-car-reading-per-day").find(":selected").attr("brand"),
                    'car_vehicleno': $("select.customer-car-reading-per-day").find(":selected").attr("vehicleno")
                })
            });
            methods.on('keyup', '.customer-car-reading-expected, .customer-current-reading', function() {
                var expected_reading = parseInt($('.customer-car-reading-expected').val());
                var reading = parseInt($('.customer-current-reading').val());
                var perday_reading = parseInt($('.customer-car-reading-per-day-input').val());

                $('.customer-next-oil-change').val("");
                var addition = expected_reading + reading;
                $('.customer-next-oil-change').val(addition);

                var result = new Date();
                result.setDate(result.getDate() + parseInt(expected_reading / perday_reading));
                $(".customer-next-oil-date").datepicker("setDate", result);
            });
            return methods;
        }
    })
})