$(function(){
    $('body').append('<link rel="stylesheet" href="/tst_changes_fixes/static/src/css/pos_cars.css" />');
});

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
            this.current_car = undefined;
            this.vehicle_no = '';
            this._super(parent, args);
        },
        show: function(options){
            this.selected_car = options.current_car || options.selected_car;
            this.vehicle_no = this.selected_car.vehicle_no;
            console.log(this.current_car, 444);
            this._super(options);
        }
    });

    carCustomerSearchWidget.include({
        init: function(parent, args) {
            this._super(parent, args);
            this.current_page = 1;
            this.page_count = 0;
            this.search_count = 0;
            this.total_count = 0;
            this.pagingLastShowCar = 0;
            this.pagingShowCarJumpCount = 20;
            this.pagingNextShowCar = 0;
            $('body').on('focus', '.input-search-car', function(ev) {
                setTimeout(function() {
                    ev.target.select();
                }, 500);
            });
        },
        set_counts: function(set_from, search_count){
            let self = this;
            if(set_from == 'search'){
                self.search_count = search_count;
            }
            else{
                if(set_from == 'show')
                {
                    self.total_count = self.pos.usr_cars.length;
                }
                self.search_count = self.total_count;
            }
            self.current_page = 1;
            if(!self.search_count)
            {
                self.current_page = '0';
            }
            self.page_count = Math.ceil(self.search_count / self.pagingShowCarJumpCount);
            $('.pages .current_page:first').html(self.current_page);
            $('.pages .page_count:first').html(self.page_count);
            $('.counts .search_count:first').html(self.search_count);
            $('.counts .total_count:first').html(self.total_count);
        },
        show: function(options){
            let self = this;
            self._super(options);
            let search_input = $('.input-search-car');
            setTimeout(function() {
                if (options.car_id) {
                    search_input.val(options.current_car_id.vehicle_no);
                    search_input.focus();
                }
            }, 1000);
            self.set_counts('show');
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
        renderCarsTableList: function(s_type, arr) {
            var self = this;
            if(!Array.isArray(arr))
            {
                arr = self.pos.usr_cars;
            }
//            if(!s_type)
            {
                s_type = 'local';
            }
            let arr_length = arr.length;
            let start_index = (this.current_page - 1) * this.pagingShowCarJumpCount;
            let end_index_excluded = this.current_page * this.pagingShowCarJumpCount;
            if (end_index_excluded > arr_length) {
                end_index_excluded = arr_length;
            }
            this.pagingLastShowCar = start_index;
            this.pagingNextShowCar = end_index_excluded;

            //console.log(arr_length, this.pagingLastShowCar, this.pagingNextShowCar);
            var slicedArray = arr.slice(this.pagingLastShowCar, this.pagingNextShowCar);
            var methods = $(QWeb.render('TableCarsListWidget', {
                widget: this,
                slicedArr: slicedArray,
                s_type: s_type
            }));

            methods.on('click', '.set-default-car.button', function() {
                var car_id = $(this).attr("car-id");
                var car_vehicle = $(this).attr("car-vehicle-no");
                var car_partner_id = $(this).attr("car-partner-id");
                var car_index = $(this).attr("car-index-id");
                if (self.pos.table) {
                    var getId = self.pos.table.id;
                    if (!self.pos.table.currentCar) {
                        self.pos.table.currentCar = [];
                    }
                    self.pos.table.currentCar['id'] = car_id;
                    self.pos.table.currentCar['vehicle_no'] = car_vehicle;
                    self.pos.table.currentCar['car_index_id'] = car_index;
                    if (!self.pos.tables_by_id[getId].currentCar) {
                        self.pos.tables_by_id[getId].currentCar = [];
                    }
                    self.pos.tables_by_id[getId].currentCar['id'] = car_id;
                    self.pos.tables_by_id[getId].currentCar['vehicle_no'] = car_vehicle;
                    self.pos.tables_by_id[getId].currentCar['car_index_id'] = car_index;

                    $('.searchbox.default-partner-car').text(car_vehicle);
                    var setPartner = -1;
                    $.each(self.pos.partners, function(index, vals) {
                        if (vals.id == car_partner_id) {
                            setPartner = vals;
                            return false;
                        }
                    });

                    var setPartner = self.pos.db.get_partner_by_id(car_partner_id);
                    if (!self.pos.tables_by_id[getId].currentCustomer) {
                        self.pos.tables_by_id[getId].currentCustomer = [];
                    }
                    self.pos.tables_by_id[getId].currentCustomer['id'] = setPartner.id;
                    self.pos.tables_by_id[getId].currentCustomer['name'] = setPartner.name;

                    var order = self.pos.get_order();
                    order.set_client(setPartner);
                    self.gui.close_popup();

                    if (self.customerSelected != 'n') {
                        self.gui.back()
                    }
                }
                self.pos.db.store_tst_data(self.pos.tables_by_id);
            });

            if (slicedArray.length != 0) {
                return methods;
            } else {
                return 'n';
            }
        },
        clear_search_string: function() {
            var self = this;

            $(".clear-search-result").hide();
            $(".input-search-car").val('');
            var car_list_widget = self.renderCarsTableList('', '');
            if (car_list_widget != 'n') {
                this.$('.client-cars-list tbody').html('');
                car_list_widget.appendTo(this.$('.client-cars-list tbody'));
            }

            self.isSearch = false;
            self.set_counts('clear search');
        },
        prev_val: undefined,
        search_partner_table: function(e) {
            var self = this;
            if (e.keyCode == 27) {
                let cancel_button = $('.car-list-creation .footer .button.cancel:first');
                if (cancel_button.length) {
                    cancel_button.click();
                }
            }
            let val_now = $(e.currentTarget).val().toLowerCase();
            if (val_now === this.prev_val && e.keyCode != 13) {
                return;
            }
            this.current_page = 1;
            this.prev_val = val_now;
            if (e.keyCode) {
                if (val_now == '') {
                    $(".clear-search-result").click();
                }
                $(".clear-search-result").show();
                var search_str = val_now;
                var newThisIs = this;
                var results = Array();
                for (var i in self.pos.usr_cars) {
                    var partner_det = self.pos.db.get_partner_by_id(self.pos.usr_cars[i].partner_id[0]);
                    var partner_phone = '';
                    var car_brand = '';
                    var car_mod = '';

                    if (partner_det) {
                        if (self.pos.db.get_partner_by_id(self.pos.usr_cars[i].partner_id[0]).phone) {
                            partner_phone = self.pos.db.get_partner_by_id(self.pos.usr_cars[i].partner_id[0]).phone.toLowerCase();
                        } else if (self.pos.db.get_partner_by_id(self.pos.usr_cars[i].partner_id[0]).mobile) {
                            partner_phone = self.pos.db.get_partner_by_id(self.pos.usr_cars[i].partner_id[0]).mobile.toLowerCase();
                        }
                    }
                    if (self.pos.usr_cars[i].car_brand[1]) {
                        car_brand = self.pos.usr_cars[i].car_brand[1].toLowerCase();
                    }
                    if (self.pos.usr_cars[i].car_model) {
                        car_mod = self.pos.usr_cars[i].car_model.toLowerCase();
                    }

                    if (car_brand.indexOf(search_str) !== -1) {
                        results.push(self.pos.usr_cars[i]);
                    } else if (self.pos.usr_cars[i].partner_id[1].toLowerCase().indexOf(search_str) !== -1) {
                        results.push(self.pos.usr_cars[i]);
                    } else if (car_mod.indexOf(search_str) !== -1) {
                        results.push(self.pos.usr_cars[i]);
                    } else if (self.pos.usr_cars[i].vehicle_no.toLowerCase().indexOf(search_str) !== -1) {
                        results.push(self.pos.usr_cars[i]);
                    } else if (partner_phone.indexOf(search_str) !== -1) {
                        results.push(self.pos.usr_cars[i]);
                    }
                }
                self.isSearch = true;
                self.searchResult = results;
                var car_list_widget = newThisIs.renderCarsTableList('server', results);
                if (car_list_widget != 'n') {
                    $('.client-cars-list tbody').html('');
                    car_list_widget.appendTo($('.client-cars-list tbody'));
                } else {
                    $('.client-cars-list tbody').html('<tr><td colspan="6" style="text-align:center">No Results Found</td></tr>')
                }
                self.search_count = results.length;
                self.set_counts('search', results.length);
            }
        },
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
                current_car: selected_car,
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
                    for(let read in readings)
                    {
                        read.create_date = date_time_format.process(read.create_date);
                    }
                    selected_car.car_readings = readings;
                }
                self.gui.show_popup('car_reading_widget', {
                    'car_readings': readings,
                    current_car: selected_car,
                    selected_car: selected_car,
                    'sam': '4566',
                    'sam2': '8666',
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
});

let date_time_format = {
    format: function(d){
        if(d<10)
        {
            d = "0" + d;
        }
        return d;
    },
    process: function(dt) {
        var todayTime = new Date();
        if (dt)
        {
            console.log(typeof(dt));
            if(typeof(dt) == 'string')
            {
                todayTime = new Date(dt)
            }
            else{
                todayTime = dt;
            }
        }

        var second = this.format(todayTime.getSeconds());
        var minute = this.format(todayTime.getMinutes());
        var hour = this.format(todayTime.getHours());
        var month = this.format(todayTime.getMonth() + 1);
        var day = this.format(todayTime.getDate());
        var year = todayTime.getFullYear();
        return year + "-" + month + "-" + day + " " + hour + ":" + minute + ":" + second;
    }
}

//# sourceMappingURL=/tst_changes_fixes/static/src/js/pos_cars_debug.js