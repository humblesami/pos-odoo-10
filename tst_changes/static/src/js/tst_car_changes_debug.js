odoo.define('pos_product_creation', function (require) {
    "use strict";

    var gui = require('point_of_sale.gui');
    var Class = require('web.Class');
    var Model = require('web.Model');
    var chrome = require('point_of_sale.chrome');
    var core = require('web.core');
    var pos_db = require('point_of_sale.DB');
    var screens = require('point_of_sale.screens');
    var pos_models = require('point_of_sale.models');
    var utils = require('web.utils');
    var PosBaseWidget = require('point_of_sale.BaseWidget');

    var QWeb = core.qweb;
    var _t = core._t;

    var BarcodeParser = require('barcodes.BarcodeParser');
    var PopupWidget = require('point_of_sale.popups');
    var RestaurantFloor = require('pos_restaurant.floors');
    var ScreenWidget = screens.ClientListScreenWidget;
    var PaymentScreenWidget = screens.PaymentScreenWidget;

    function update_domain(required_model, op, domain){
        if(!required_model.domain)
        {
            required_model.domain = [];
        }
        if(!required_model.original_domain)
        {
            required_model.original_domain = required_model.domain;
        }
        if(op == 'add')
        {
            var ar1 = [];
            for (let item of required_model.original_domain)
            {
                ar1.push(item);
            }
            ar1.push(domain)
            required_model.domain = ar1;
        }
        else if(op == 'restore')
        {
            required_model.domain = required_model.original_domain;
        }
        else if(op == 'replace')
        {
            required_model.domain = domain
        }
        //console.log(required_model);
    }

    //gets pos_instance to call load_server_data later, when limited data obtained once
    var pos_instance = undefined;
    var framework = require('web.framework');
    pos_models.PosModel = pos_models.PosModel.extend({
        set_table: function (table) {
            if (!table) { // no table ? go back to the floor plan, see ScreenSelector
                this.set_order(null);
            }
            else if (this.order_to_transfer_to_different_table) {
                var tst_order_to_transfer = this.order_to_transfer_to_different_table;
                $.each(this.order_to_transfer_to_different_table.pos.tables_by_id, function (index, vals) {
                    if (vals.id == tst_order_to_transfer.table.id) {
                        table.currentCar = tst_order_to_transfer.pos.tables_by_id[index].currentCar;
                        table.currentCustomer = tst_order_to_transfer.pos.tables_by_id[index].currentCustomer;
                        table.selected_employees = tst_order_to_transfer.pos.tables_by_id[index].selected_employees;

                        tst_order_to_transfer.pos.tables_by_id[index].currentCar = [];
                        tst_order_to_transfer.pos.tables_by_id[index].currentCustomer = [];
                        tst_order_to_transfer.pos.tables_by_id[index].selected_employees = [];
                    }
                });
                this.order_to_transfer_to_different_table.table = table;
                tst_order_to_transfer.table = table;
                tst_order_to_transfer.save_to_db();
                this.order_to_transfer_to_different_table = null;

                this.set_table(table);
            }
            else {
                this.table = table;
                var orders = this.get_order_list();
                if (orders.length) {
                    this.set_order(orders[0]); // and go to the first one ...
                }
                else {
                    this.add_new_order();  // or create a new order with the current table
                }
            }
        },
        load_server_data: function(){
            var self = pos_instance = this;
            let model_name = 'res.partner';
            let required_model = pos_instance.models.filter((item)=>{
                return item.model == model_name;
            });
            if(required_model.length){
                required_model = required_model[0];
                required_model.loaded = function(self,partners){
                    self.partners = partners;
                    self.db.add_partners(partners);
                },
                update_domain(required_model, 'add', ['limit','=',30])
            }

            model_name = 'user.cars';
            required_model = pos_instance.models.filter((item)=>{
                return item.model == model_name;
            });
            if(required_model.length){
                required_model = required_model[0];
                update_domain(required_model, 'add', ['limit','=',30])
            }
            var loaded = new $.Deferred();
            var progress = 0;
            var progress_step = 1.0 / self.models.length;
            var tmp = {}; // this is used to share a temporary state between models loaders

            function load_model(index){
                if(index >= self.models.length){
                    loaded.resolve();
                }else{
                    var model = self.models[index];
                    self.chrome.loading_message(_t('Loading')+' '+(model.label || model.model || ''), progress);

                    var cond = typeof model.condition === 'function'  ? model.condition(self,tmp) : true;
                    if (!cond) {
                        load_model(index+1);
                        return;
                    }

                    var fields =  typeof model.fields === 'function'  ? model.fields(self,tmp)  : model.fields;
                    var domain =  typeof model.domain === 'function'  ? model.domain(self,tmp)  : model.domain;
                    var context = typeof model.context === 'function' ? model.context(self,tmp) : model.context;
                    var ids     = typeof model.ids === 'function'     ? model.ids(self,tmp) : model.ids;
                    var order   = typeof model.order === 'function'   ? model.order(self,tmp):    model.order;
                    progress += progress_step;

                    var records;
                    if( model.model ){
                        if (model.ids) {
                            records = new Model(model.model).call('read',[ids,fields],context);
                        } else {
                            records = new Model(model.model)
                                .query(fields)
                                .filter(domain)
                                .order_by(order)
                                .context(context)
                                .all();
                        }
                        records.then(function(result){
                                try{    // catching exceptions in model.loaded(...)
                                    $.when(model.loaded(self,result,tmp))
                                        .then(function(){ load_model(index + 1); },
                                              function(err){ loaded.reject(err); });
                                }catch(err){
                                    console.error(err.message, err.stack);
                                    loaded.reject(err);
                                }
                            },function(err){
                                loaded.reject(err);
                            });
                    }else if( model.loaded ){
                        try{    // catching exceptions in model.loaded(...)
                            $.when(model.loaded(self,tmp))
                                .then(  function(){ load_model(index +1); },
                                        function(err){ loaded.reject(err); });
                        }catch(err){
                            loaded.reject(err);
                        }
                    }else{
                        load_model(index + 1);
                    }
                }
            }

            try{
                load_model(0);
            }catch(err){
                loaded.reject(err);
            }

            return loaded;
        },
        load_server_data1: function (model_name, domain) {
            var self = this;
            var loaded = new $.Deferred();
            var progress = 0;
            var progress_step = 1.0;
            var tmp = {}; // this is used to share a temporary state between models loaders

            function load_model(model) {
                var fields = typeof model.fields === 'function' ? model.fields(self, tmp) : model.fields;
                var domain = typeof model.domain === 'function' ? model.domain(self, tmp) : model.domain;
                var context = typeof model.context === 'function' ? model.context(self, tmp) : model.context;
                var ids = typeof model.ids === 'function' ? model.ids(self, tmp) : model.ids;
                var order = typeof model.order === 'function' ? model.order(self, tmp) : model.order;
                progress += progress_step;
                var records;
                records = new Model(model.model)
                    .query(fields)
                    .filter(domain)
                    .order_by(order)
                    .context(context)
                    .all();
                setTimeout(function () {
                    framework.unblockUI();
                }, 5000);
                records.then(function (result) {
                    try {
                        $.when(model.loaded(self, result, tmp))
                            .then(function () { },
                                function (err) { loaded.reject(err); });
                    } catch (err) {
                        console.error(err.message, err.stack);
                        loaded.reject(err);
                    }
                }, function (err) {
                    loaded.reject(err);
                });
            }

            try {
                let required_model = pos_instance.models.filter((item) => {
                    return item.model == model_name;
                });
                if(required_model.length)
                {
                    required_model = required_model[0];
                    if(domain)
                    {
                        update_domain(required_model, 'replace', domain);
                    }
                    else{
                        update_domain(required_model, 'restore');
                    }
                    console.log('Loading full data for ' + required_model.model);
                    load_model(required_model);
                }
            } catch (err) {
                loaded.reject(err);
            }
            return loaded;
        },
    });

    console.log('Started at ' + format_time());

    function format_time(dt) {
        if (!dt) {
            dt = new Date();
        }
        try {
            const ye = new Intl.DateTimeFormat('en', { year: 'numeric' }).format(dt)
            const mo = new Intl.DateTimeFormat('en', { month: '2-digit' }).format(dt)
            const da = new Intl.DateTimeFormat('en', { day: '2-digit' }).format(dt)
            const hr = new Intl.DateTimeFormat('en', { hour: '2-digit' }).format(dt)
            const mn = new Intl.DateTimeFormat('en', { minute: '2-digit' }).format(dt)
            const sec = new Intl.DateTimeFormat('en', { second: '2-digit' }).format(dt)
            var res = `${ye}-${mo}-${da}-${hr}-${mn}-${sec}`;
            res = `${mn}-${sec}`;
            return res;
        }
        catch (er) {
            console.log(er);
        }
        return dt;
    }

    pos_models.load_models({
        model: 'user.cars',
        fields: ['name', 'id', 'car_brand', 'car_model', 'vehicle_no', 'car_status', 'partner_id', 'car_readaing_per_day', 'oil_change_after_readaing'],
        domain: [['car_status', '=', 'active']],
        loaded: function (self, usr_cars) {
            self.usr_cars = usr_cars;
            self.db.add_cars(usr_cars);
            var loaded_type = 'Load type: initial load';
            if (pos_instance.all_cars_loaded) {
                loaded_type = 'Load type: full load';
            }
            console.log(loaded_type, ', count : ' + usr_cars.length, ', time: ' + format_time());
//            if (!pos_instance.all_cars_loaded) {
//                pos_instance.all_cars_loaded = 1;
//                pos_instance.load_server_data1('user.cars');
//            }
        },
    });

    pos_models.load_models({
        model: 'user.cars.readings',
        fields: ['per_day_reading', 'current_readaing', 'next_oil_change_km', 'next_oil_change_date', 'car_id', 'id', 'create_date', 'pos_order_id'],
        loaded: function (self, cars_readings) {
            self.cars_readings = cars_readings;
        },
    });

    pos_models.load_models({
        model: 'hr.employee',
        fields: ['id', 'name'],
        domain: function (self) { return [['is_dock_user', '=', true]]; },
        loaded: function (self, employees) {
            self.employees = employees;
            self.db.load_tst_data('load_employees');
        },
    });

    pos_models.load_models({
        model: 'user.cars.brands',
        fields: ['id', 'car_brand'],
        loaded: function (self, brands) {
            self.car_brands = brands;
        },
    });

    //pos_models.load_fields('res.partner','cars_id');
    pos_models.load_fields('pos.config', 'reciept_logo');
    pos_models.load_fields('product.product', ['product_disc_percentage', 'product_disc', 'pos_discount_apply']);

    chrome.UsernameWidget.include({
        renderElement: function () {
            var self = this;
            this._super();

            this.$el.click(function (e) {
                if ($(this).hasClass("username")) {
                    self.click_username();
                }
                else if ($(this).hasClass("select-emplyees")) {
                    var employees = [];
                    for (var i in self.pos.employees) {
                        employees.push(self.pos.employees[i]);
                    }
                    self.gui.show_popup('select_employees_widget', {
                        'employees': employees,
                    })
                }
            });
        },
    });

    var carReadingWidget = PosBaseWidget.extend({
        template: 'CarShowReadingsWidget',
        init: function (parent, args) {
            this._super(parent, args);
            this.car_readings = [];
            this.car_id = '';
            this.car_brand = '';
            this.car_vehicleno = '';
        },
        start: function () {
            this._super();
            var self = this;
            this.getParent().on("view_content_has_changed", this, function () {
                self.render_value();
            });
        },
        events: {
            'click .button.cancel': 'click_cancel',
        },
        show: function (options) {
            options = options || {};
            this._super(options);
            this.car_readings = options.car_readings
            this.car_id = options.car_id
            this.car_brand = options.car_brand;
            this.car_vehicleno = options.car_vehicleno;
            this.renderElement();
        },
        renderElement: function () {
            var self = this;
            this._super();

            this.$('.button.view-order').click(function () {
                var order = $(this).attr('order-id');
                $(".readings-order-table-row").remove();
                var closestTr = $(this).closest('tr');
                var order_vals = {
                    'order_id': order,
                };
                new Model('pos.order').call('get_pos_order', [1, order_vals]).then(function (product) {
                    $(product).insertAfter(closestTr);
                });
            });
        },
        close: function () {
            if (this.pos.barcode_reader) {
                this.pos.barcode_reader.restore_callbacks();
            }
        },
        click_cancel: function () {
            this.gui.close_popup();
        },
    });
    gui.define_popup({ name: 'car_reading_widget', widget: carReadingWidget });

    var selectEmployeesWidget = PosBaseWidget.extend({
        template: 'SelectWorkingEmployeesWidget',
        init: function (parent, args) {
            this._super(parent, args);
            this.emp_id = [];
            this.selected_employees = [];
        },
        start: function () {
            this._super();
            var self = this;
        },
        events: {
            'click .button.cancel': 'click_cancel',
            'click .done-select': 'done_select',
        },
        done_select: function () {
            var employees = []
            this.$('.employee-selected[type="checkbox"]:checked').each(function (index, element) {
                employees.push($(element).val());
            });

            if (!this.pos.tables_by_id[this.pos.table.id].selected_employees) {
                this.pos.tables_by_id[this.pos.table.id].selected_employees = [];
            }
            this.pos.tables_by_id[this.pos.table.id].selected_employees = employees;
            this.pos.db.store_tst_data(this.pos.tables_by_id);
            this.gui.close_popup();
        },
        show: function (options) {
            options = options || {};
            this._super(options);
            this.emp_id = options.employees;
            if (this.pos.table) { this.selected_employees = this.pos.tables_by_id[this.pos.table.id].selected_employees; }
            else { this.selected_employees = []; }

            this.renderElement();
        },
        close: function () {
            if (this.pos.barcode_reader) {
                this.pos.barcode_reader.restore_callbacks();
            }
        },
        click_cancel: function () {
            this.gui.close_popup();
        },
    });
    gui.define_popup({ name: 'select_employees_widget', widget: selectEmployeesWidget });

    var carListCreationWidget = PosBaseWidget.extend({
        template: 'CarCreationWidget',
        init: function (parent, args) {
            this._super(parent, args);
            this.customer_name = '';
            this.customer_id = '';
            this.usr_cars = [];
            this.car_brands = [];
        },
        start: function () {
            this._super();
            var self = this;
            this.getParent().on("view_content_has_changed", this, function () {
                self.render_value();
            });
        },
        events: {
            'click .button.cancel': 'click_cancel',
            'click .button.confirm': 'click_confirm',
            'click .button.set-customer': 'click_set_car',
        },
        show: function (options) {
            options = options || {};
            this._super(options);
            this.customer_name = options.customer_name;
            this.customer_id = options.customer_id;
            this.usr_cars = options.usr_cars;
            this.car_brands = options.car_brands;
            var curr = -1;
            if (this.pos.table.currentCar) {
                curr = parseInt(this.pos.table.currentCar['id']);
            }
            this.currentCar = curr;
            this.renderElement();
            this.$('.car_type').focus();
        },
        close: function () {
            if (this.pos.barcode_reader) {
                this.pos.barcode_reader.restore_callbacks();
            }
        },
        click_set_car: function () {

        },
        click_confirm: function () {
            var self = this;
            var getit = this;
            var car_model = this.$('.product-creation-form .car_model').val();
            var car_vehicle_no = this.$('.product-creation-form .car_vehicle_no').val();
            var car_type = this.$(".product-creation-form .car_type").find(":selected").val();
            var partner_id = this.$('.product-creation-form .car_customer_id').val();
            var car_read_per_day = this.$('.product-creation-form .car_read_per_day').val();
            var car_read_oil_change = this.$('.product-creation-form .car_read_oil_change').val();

            if (!car_model) {
                alert("Please provide car model");
            }
            else if (!car_vehicle_no) {
                alert("Please provide car vehicle no");
            }
            else {
                var product_vals = {
                    'car_brand': car_type,
                    'car_model': car_model,
                    'vehicle_no': car_vehicle_no,
                    'partner_id': partner_id,
                    'car_readaing_per_day': car_read_per_day,
                    'oil_change_after_readaing': car_read_oil_change
                };
                new Model('user.cars').call('create_car', [1, product_vals]).then(function (product) {
                    if (product == 'Vehicle No Already Exist') {
                        $(".product-creation-form-error").text(product);
                        $(".product-creation-form-error").show();
                    }
                    else {
                        self.pos.usr_cars.push(product);
                        self.pos.db.add_single_car(product);
                        getit.gui.close_popup();
                    }
                });
            }
        },
        check_car_available: function (car_id) {
            var matched = 0;
            $.each(this.pos.tables_by_id, function (index, vals) {
                if (vals.currentCar) {
                    if (vals.currentCar['id'] == car_id) {
                        matched = 1;
                    }
                }
            });
            return matched;
        },
        renderElement: function () {
            var self = this;
            this._super();

            this.$('.set-default-car.button').click(function () {
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
                    $.each(self.pos.partners, function (index, vals) {
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
                }
                self.pos.db.store_tst_data(self.pos.tables_by_id);
            });
        },
        click_cancel: function () {
            this.gui.close_popup();
        },
    });
    gui.define_popup({ name: 'car_list_create', widget: carListCreationWidget });

    pos_db.include({
        init: function (options) {
            options = options || {};
            this.name = options.name || this.name;
            this.limit = options.limit || this.limit;

            if (options.uuid) {
                this.name = this.name + '_' + options.uuid;
            }

            //cache the data in memory to avoid roundtrips to the localstorage
            this.cache = {};

            this.product_by_id = {};
            this.product_by_barcode = {};
            this.product_by_category_id = {};

            this.partner_sorted = [];
            this.partner_by_id = {};
            this.partner_by_barcode = {};
            this.partner_search_string = "";
            this.partner_write_date = null;

            this.category_by_id = {};
            this.root_category_id = 0;
            this.category_products = {};
            this.category_ancestors = {};
            this.category_childs = {};
            this.category_parent = {};
            this.category_search_string = {};

            this.user_cars = {};
        },
        load_tst_data: function (param) {
            if (localStorage.getItem('tstData')) {
                var getSaved = JSON.parse(localStorage.getItem('tstData'));
                var counter = 0;
                $.each(self.posmodel.tables_by_id, function (index, vals) {
                    $.each(getSaved, function (pindex, pvals) {
                        if (vals.id == pvals.id) {
                            if (pvals.selected_employees) {
                                self.posmodel.tables_by_id[index].selected_employees = pvals.selected_employees;
                            }
                            if (pvals.currentCustomer) {
                                self.posmodel.tables_by_id[index].currentCustomer = [];
                                self.posmodel.tables_by_id[index].currentCustomer['id'] = pvals.currentCustomer.id;
                                self.posmodel.tables_by_id[index].currentCustomer['name'] = pvals.currentCustomer.name;
                            }
                            if (pvals.currentCar) {
                                self.posmodel.tables_by_id[index].currentCar = [];
                                self.posmodel.tables_by_id[index].currentCar['id'] = pvals.currentCar.id;
                                self.posmodel.tables_by_id[index].currentCar['vehicle_no'] = pvals.currentCar.vehicle_no;
                            }
                        }
                    });
                    counter = counter + 1;
                });
            }
        },
        store_tst_data: function (dataToStore) {
            var dataToStoreArr = [];
            var counter = 0;
            $.each(dataToStore, function (index, vals) {
                if (!dataToStoreArr[counter]) {
                    dataToStoreArr[counter] = {};
                }
                dataToStoreArr[counter].id = vals.id;
                dataToStoreArr[counter].name = vals.name;
                if (vals.selected_employees) {
                    dataToStoreArr[counter].selected_employees = vals.selected_employees;
                }
                if (vals.currentCustomer) {
                    dataToStoreArr[counter].currentCustomer = {};
                    dataToStoreArr[counter].currentCustomer.id = vals.currentCustomer.id;
                    dataToStoreArr[counter].currentCustomer.name = vals.currentCustomer.name;
                }
                if (vals.currentCar) {
                    dataToStoreArr[counter].currentCar = {};
                    dataToStoreArr[counter].currentCar.id = vals.currentCar.id;
                    dataToStoreArr[counter].currentCar.vehicle_no = vals.currentCar.vehicle_no;
                }
                counter = counter + 1;
            });
            var jsn = JSON.stringify(dataToStoreArr);
            localStorage.setItem("tstData", jsn);
        },
        add_single_car: function (user_car) {
            var car = user_car;
            if (!this.partner_by_id[car.partner_id[0]].partner_cars) {
                this.partner_by_id[car.partner_id[0]].partner_cars = [];
            }
            this.partner_by_id[car.partner_id[0]].partner_cars.push(car);

            for (var id in this.partner_by_id) {
                var partner = this.partner_by_id[id];
                if (partner.barcode) { this.partner_by_barcode[partner.barcode] = partner; }
                partner.address = (partner.street || '') + ', ' +
                    (partner.zip || '') + ' ' +
                    (partner.city || '') + ', ' +
                    (partner.country_id[1] || '');
                this.partner_search_string += this._partner_search_string(partner);
            }
        },
        add_cars: function (user_cars) {
            var updated_count = 0;
            for (var i = 0, len = user_cars.length; i < len; i++) {
                var car = user_cars[i];
                this.user_cars[car.id] = car;
                updated_count += 1;

                if (this.partner_by_id[car.partner_id[0]]) {
                    if (!this.partner_by_id[car.partner_id[0]].partner_cars) {
                        this.partner_by_id[car.partner_id[0]].partner_cars = [];
                    }
                    this.partner_by_id[car.partner_id[0]].partner_cars.push(car);
                }
            }
            this.partner_search_string = "";
            for (var id in this.partner_by_id) {
                var partner = this.partner_by_id[id];
                if (partner.barcode) {
                    this.partner_by_barcode[partner.barcode] = partner;
                }
                partner.address = (partner.street || '') + ', ' +
                    (partner.zip || '') + ' ' +
                    (partner.city || '') + ', ' +
                    (partner.country_id[1] || '');
                this.partner_search_string += this._partner_search_string(partner);
            }
            return updated_count;
        },

        _partner_search_string: function (partner) {
            var str = partner.name;
            if (partner.barcode) {
                str += '|' + partner.barcode;
            }
            if (partner.address) {
                str += '|' + partner.address;
            }
            if (partner.phone) {
                str += '|' + partner.phone.split(' ').join('');
            }
            if (partner.mobile) {
                str += '|' + partner.mobile.split(' ').join('');
            }
            if (partner.email) {
                str += '|' + partner.email;
            }
            if (partner.partner_cars) {
                for (var i = 0; i < partner.partner_cars.length; i++) {
                    str += '|' + partner.partner_cars[i].vehicle_no;
                }
            }
            str = '' + partner.id + ':' + str.replace(':', '') + '\n';
            return str;
        },
        add_order: function (order) {
            var order_id = order.uid;
            var orders = this.load('orders', []);

            // if the order was already stored, we overwrite its data
            for (var i = 0, len = orders.length; i < len; i++) {
                if (orders[i].id === order_id) {
                    orders[i].data = order;
                    this.save('orders', orders);
                    return order_id;
                }
            }

            // Only necessary when we store a new, validated order. Orders
            // that where already stored should already have been removed.
            this.remove_unpaid_order(order);

            var employees = []
            $('.employee-selected[type="checkbox"]:checked').each(function (index, element) {
                employees.push($(element).val());
            });
            order.selected_employees = employees
            order.selected_car = $("[name='select-car-model']").val();

            order.car_reading = $("[name='car-reading-per-day']").val();
            order.car_current_reading = $("[name='car-current-reading']").val();
            order.next_oil_change = $("[name='car-next-oil-change']").val();
            order.next_oil_change_date = $("[name='car-next-oil-date']").val();

            orders.push({ id: order_id, data: order });
            this.save('orders', orders);

            var readaingNew = {}
            readaingNew.car_id = []
            readaingNew.car_id[0] = $("[name='select-car-model']").val();
            readaingNew.current_readaing = $("[name='car-current-reading']").val();
            readaingNew.next_oil_change_date = $("[name='car-current-reading']").val();
            readaingNew.next_oil_change_km = $("[name='car-next-oil-change']").val();
            readaingNew.per_day_reading = $("[name='car-next-oil-date']").val();
            readaingNew.create_date = new Date();
            self.posmodel.cars_readings.push(readaingNew);

            self.posmodel.orderFlag = 17;

            return order_id;
        },
        add_partners: function (partners) {
            var updated_count = 0;
            var new_write_date = '';
            var partner;
            for (var i = 0, len = partners.length; i < len; i++) {
                partner = partners[i];

                var local_partner_date = (this.partner_write_date || '').replace(/^(\d{4}-\d{2}-\d{2}) ((\d{2}:?){3})$/, '$1T$2Z');
                var dist_partner_date = (partner.write_date || '').replace(/^(\d{4}-\d{2}-\d{2}) ((\d{2}:?){3})$/, '$1T$2Z');
                if (this.partner_write_date && this.partner_by_id[partner.id] && new Date(local_partner_date).getTime() + 1000 >= new Date(dist_partner_date).getTime()) {
                    continue;
                }
                else if (new_write_date < partner.write_date) {
                    new_write_date = partner.write_date;
                }
                if (!this.partner_by_id[partner.id]) {
                    this.partner_sorted.push(partner.id);
                }
                this.partner_by_id[partner.id] = partner;
                updated_count += 1;
            }
            this.partner_write_date = new_write_date || this.partner_write_date;
            if (updated_count) {
                this.partner_search_string = "";
                this.partner_by_barcode = {};

                for (var id in this.partner_by_id) {
                    partner = this.partner_by_id[id];
                    if (partner.barcode) {
                        this.partner_by_barcode[partner.barcode] = partner;
                    }
                    partner.address = (partner.street || '') + ', ' +
                        (partner.zip || '') + ' ' +
                        (partner.city || '') + ', ' +
                        (partner.country_id[1] || '');
                    this.partner_search_string += this._partner_search_string(partner);
                }
            }
            return updated_count;
        },
    });

    PaymentScreenWidget.include({
        init: function (parent, options) {
            var self = this;
            this._super(parent, options);

            this.pos.bind('change:selectedOrder', function () {
                this.renderElement();
                this.watch_order_changes();
                $("#pos-rounding").trigger("click");
            }, this);
            this.watch_order_changes();

            this.inputbuffer = "";
            this.firstinput = true;
            this.decimal_point = _t.database.parameters.decimal_point;

            // This is a keydown handler that prevents backspace from
            // doing a back navigation. It also makes sure that keys that
            // do not generate a keypress in Chrom{e,ium} (eg. delete,
            // backspace, ...) get passed to the keypress handler.
            this.keyboard_keydown_handler = function (event) {
                if (!$(event.srcElement).hasClass("customer-oil-change")) {
                    if (event.keyCode === 8 || event.keyCode === 46) { // Backspace and Delete
                        event.preventDefault();
                        self.keyboard_handler(event);
                    }
                }
            };

            // This keyboard handler listens for keypress events. It is
            // also called explicitly to handle some keydown events that
            // do not generate keypress events.
            this.keyboard_handler = function (event) {
                var key = '';
                if (!$(event.srcElement).hasClass("customer-oil-change")) {
                    if (event.type === "keypress") {
                        if (event.keyCode === 13) { // Enter
                            self.validate_order();
                        }
                        else if (event.keyCode === 190 || // Dot
                            event.keyCode === 110 ||  // Decimal point (numpad)
                            event.keyCode === 188 ||  // Comma
                            event.keyCode === 46) {  // Numpad dot
                            key = self.decimal_point;
                        }
                        else if (event.keyCode >= 48 && event.keyCode <= 57) { // Numbers
                            key = '' + (event.keyCode - 48);
                        }
                        else if (event.keyCode === 45) { // Minus
                            key = '-';
                        }
                        else if (event.keyCode === 43) { // Plus
                            key = '+';
                        }
                    }
                    else { // keyup/keydown
                        if (event.keyCode === 46) { // Delete
                            key = 'CLEAR';
                        }
                        else if (event.keyCode === 8) { // Backspace
                            key = 'BACKSPACE';
                        }
                    }

                    self.payment_input(key);
                    event.preventDefault();
                }
            };

            this.pos.bind('change:selectedClient', function () {
                self.customer_changed();
            }, this);
        },
        render_readingwidget: function () {
            var self = this;
            var current_car_index = -1;
            if (self.pos.table) {
                if (self.pos.table.currentCar) {
                    if (self.pos.table.currentCar['car_index_id']) {
                        current_car_index = self.pos.usr_cars[parseInt(self.pos.table.currentCar['car_index_id'])];
                    }
                }
            }
            var methods = $(QWeb.render('TstCarReadingWidget', { widget: this, currentCarIndex: current_car_index }));
            methods.find(".customer-next-oil-date").datepicker({ minDate: 0 });
            methods.on('click', '.view-car-readings', function () {
                var reading = [];
                for (var i in self.pos.cars_readings) {
                    reading.push(self.pos.cars_readings[i]);
                }
                self.gui.show_popup('car_reading_widget', {
                    'car_readings': reading,
                    'car_id': $("select.customer-car-reading-per-day").find(":selected").val(),
                    'car_brand': $("select.customer-car-reading-per-day").find(":selected").attr("brand"),
                    'car_vehicleno': $("select.customer-car-reading-per-day").find(":selected").attr("vehicleno")
                })
            });
            methods.on('keyup', '.customer-car-reading-expected, .customer-current-reading', function () {
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
        },
        renderElement: function () {
            var self = this;
            this._super();

            var reading_widget = this.render_readingwidget();
            reading_widget.appendTo(this.$('.paymentmethods-container'));
        },
        show: function () {
            this.pos.get_order().clean_empty_paymentlines();
            this.reset_input();
            this.render_paymentlines();
            this.order_changes();
            this.usr_cars = this.pos.usr_cars;
            this.selectedUser = this.pos.changed;

            this.$('.tst-car-readings-section').remove();
            var reading_widget = this.render_readingwidget();
            reading_widget.appendTo(this.$('.paymentmethods-container'));

            window.document.body.addEventListener('keypress', this.keyboard_handler);
            window.document.body.addEventListener('keydown', this.keyboard_keydown_handler);
            this._super();
        }
    });
    ScreenWidget.include({
        showAddCarPopup: function (partner) {
            var cars = [];
            for (var i in this.pos.usr_cars) {
                cars.push(this.pos.usr_cars[i]);
            }

            this.gui.show_popup('car_list_create', {
                'customer_name': partner.name,
                'customer_id': partner.id,
                'usr_cars': cars,
                'car_brands': this.pos.car_brands,
                'confirm': function (value) { },
            })
        },
        display_client_details: function (visibility, partner, clickpos) {
            var self = this;
            var searchbox = this.$('.searchbox input');
            var contents = this.$('.client-details-contents');
            var parent = this.$('.client-list').parent();
            var scroll = parent.scrollTop();
            var height = contents.height();

            contents.off('click', '.button.edit');
            contents.off('click', '.button.save');
            contents.off('click', '.button.undo');
            contents.off('click', '.button.add-car');
            contents.on('click', '.button.edit', function () { self.edit_client_details(partner); });
            contents.on('click', '.button.save', function () { self.save_client_details(partner); });
            contents.on('click', '.button.undo', function () { self.undo_client_details(partner); });
            contents.on('click', '.button.add-car', function () { self.showAddCarPopup(partner); });
            this.editing_client = false;
            this.uploaded_picture = null;

            if (visibility === 'show') {
                contents.empty();
                contents.append($(QWeb.render('ClientDetails', { widget: this, partner: partner })));

                var new_height = contents.height();

                if (!this.details_visible) {
                    // resize client list to take into account client details
                    parent.height('-=' + new_height);

                    if (clickpos < scroll + new_height + 20) {
                        parent.scrollTop(clickpos - 20);
                    } else {
                        parent.scrollTop(parent.scrollTop() + new_height);
                    }
                } else {
                    parent.scrollTop(parent.scrollTop() - height + new_height);
                }

                this.details_visible = true;
                this.toggle_save_button();
            } else if (visibility === 'edit') {
                // Connect the keyboard to the edited field
                if (this.pos.config.iface_vkeyboard && this.chrome.widget.keyboard) {
                    contents.off('click', '.detail');
                    searchbox.off('click');
                    contents.on('click', '.detail', function (ev) {
                        self.chrome.widget.keyboard.connect(ev.target);
                        self.chrome.widget.keyboard.show();
                    });
                    searchbox.on('click', function () {
                        self.chrome.widget.keyboard.connect($(this));
                    });
                }

                this.editing_client = true;
                contents.empty();
                contents.append($(QWeb.render('ClientDetailsEdit', { widget: this, partner: partner })));
                this.toggle_save_button();

                // Browsers attempt to scroll invisible input elements
                // into view (eg. when hidden behind keyboard). They don't
                // seem to take into account that some elements are not
                // scrollable.
                contents.find('input').blur(function () {
                    setTimeout(function () {
                        self.$('.window').scrollTop(0);
                    }, 0);
                });

                contents.find('.image-uploader').on('change', function (event) {
                    self.load_image_file(event.target.files[0], function (res) {
                        if (res) {
                            contents.find('.client-picture img, .client-picture .fa').remove();
                            contents.find('.client-picture').append("<img src='" + res + "'>");
                            contents.find('.detail.picture').remove();
                            self.uploaded_picture = res;
                        }
                    });
                });
            } else if (visibility === 'hide') {
                contents.empty();
                parent.height('100%');
                if (height > scroll) {
                    contents.css({ height: height + 'px' });
                    contents.animate({ height: 0 }, 400, function () {
                        contents.css({ height: '' });
                    });
                } else {
                    parent.scrollTop(parent.scrollTop() - height);
                }
                this.details_visible = false;
                this.toggle_save_button();
            }
        },
        show: function () {
            var self = this;
            this._super();

            this.renderElement();
            this.details_visible = false;
            this.old_client = this.pos.get_order().get_client();

            this.$('.back').click(function () {
                self.gui.back();
            });
            this.$('.next').click(function () {
                self.save_changes();
                //self.gui.back();
            });
            this.$('.new-customer').click(function () {
                self.display_client_details('edit', {
                    'country_id': self.pos.company.country_id,
                });
            });
            var partners = this.pos.db.get_partners_sorted(1000);
            this.render_list(partners);
            this.reload_partners();

            if (this.old_client) {
                this.display_client_details('show', this.old_client, 0);
            }
            this.$('.client-list-contents').delegate('.client-line', 'click', function (event) {
                self.line_select(event, $(this), parseInt($(this).data('id')));
            });
            var search_timeout = null;
            if (this.pos.config.iface_vkeyboard && this.chrome.widget.keyboard) {
                this.chrome.widget.keyboard.connect(this.$('.searchbox input'));
            }
            this.$('.searchbox input').on('keypress', function (event) {
                clearTimeout(search_timeout);
                var searchbox = this;
                search_timeout = setTimeout(function () {
                    self.perform_search(searchbox.value, event.which === 13);
                }, 70);
            });
            this.$('.searchbox .search-clear').click(function () {
                self.clear_search();
            });
        },
        save_changes: function () {
            var self = this;
            var order = this.pos.get_order();
            if (this.has_client_changed()) {
                var default_fiscal_position_id = _.find(this.pos.fiscal_positions, function (fp) {
                    return fp.id === self.pos.config.default_fiscal_position_id[0];
                });
                if (this.new_client && this.new_client.property_account_position_id) {
                    order.fiscal_position = _.find(this.pos.fiscal_positions, function (fp) {
                        return fp.id === self.new_client.property_account_position_id[0];
                    }) || default_fiscal_position_id;
                }
                else {
                    order.fiscal_position = default_fiscal_position_id;
                }
                if (!this.new_client) {
                    if (self.pos.tables_by_id[self.pos.table.id].currentCar) {
                        self.pos.tables_by_id[self.pos.table.id].currentCar = [];
                        self.pos.table.currentCar = [];
                        order.set_client(this.new_client);
                        $(".searchbox.default-partner-car").html('No Car Selected')
                        self.gui.back();
                    }
                }
                else {
                    self.gui.show_popup('car_customer_search_widget', {
                        'usr_cars': self.pos.usr_cars,
                        'partners': self.pos.partners,
                        'current_car_id': ((self.pos.table.currentCar) ? self.pos.table.currentCar['id'] : ''),
                        'customerSelected': this.new_client.id,
                        'customerSelectedName': this.new_client.name
                    });
                }

                var currTableId = self.pos.table.id;
                if (!self.pos.tables_by_id[currTableId].currentCustomer || !this.new_client) {
                    self.pos.tables_by_id[currTableId].currentCustomer = [];
                }
                if (this.new_client) {
                    self.pos.tables_by_id[currTableId].currentCustomer['id'] = this.new_client.id;
                    self.pos.tables_by_id[currTableId].currentCustomer['name'] = this.new_client.name;
                }
            }
        }
    });
    screens.ReceiptScreenWidget.include({
        render_receipt: function () {
            var order = this.pos.get_order();
            var rec_employees = [];

            if (this.pos.tables_by_id[this.pos.table.id].selected_employees) {
                $.each(this.pos.tables_by_id[this.pos.table.id].selected_employees, function (index, vals) {
                    $.each(self.posmodel.employees, function (ind, val) {
                        if (val.id == vals) {
                            rec_employees.push(val.name);
                        }
                    });
                });
            }
            this.pos.tables_by_id[this.pos.table.id].selected_employees_backup = [];
            this.pos.db.store_tst_data(this.pos.tables_by_id);
            var currentCar = this.pos.tables_by_id[this.pos.table.id].currentCar;
            var currentCustomer = this.pos.tables_by_id[this.pos.table.id].currentCustomer;
            var selected_employees = this.pos.tables_by_id[this.pos.table.id].selected_employees;

            if (this.pos.orderFlag) {
                this.pos.tables_by_id[this.pos.table.id].currentCar = [];
                this.pos.tables_by_id[this.pos.table.id].currentCustomer = [];
                this.pos.tables_by_id[this.pos.table.id].selected_employees = [];
                this.pos.db.store_tst_data(this.pos.tables_by_id);
                delete this.pos.orderFlag;
            }

            var currentCarId = '';
            if (currentCar['id']) {
                currentCarId = currentCar['id']
            }

            this.$('.pos-receipt-container').html(QWeb.render('PosTicket', {
                widget: this,
                order: order,
                receipt: order.export_for_printing(),
                orderlines: order.get_orderlines(),
                creation_date: moment(order.creation_date).format("DD-MMM-YYYY"),
                paymentlines: order.get_paymentlines(),
                car_per_day_read: $(".customer-car-reading-per-day-input").val(),
                car_per_day_read_expect: $(".customer-car-reading-expected").val(),
                car_current_read: $(".customer-current-reading").val(),
                car_next_oil_read: $(".customer-next-oil-change").val(),
                car_next_oil_date_read: $(".customer-next-oil-date").val(),
                employees: rec_employees,
                rec_logo: "data:image/png;base64," + this.pos.config.reciept_logo,
                currentCar: parseInt(currentCarId),
                currentCustomer: currentCustomer,
                selected_employees: selected_employees,
            }));
        },
    });
    screens.OrderWidget.include({
        orderline_remove: function (line) {
            this.remove_orderline(line);
            this.numpad_state.reset();
            this.update_summary();

            if ($(".order .orderlines .orderline").length == 0) {
                if (this.pos.table.currentCar) {
                    this.pos.table.currentCar = [];
                    this.pos.table.currentCustomer = [];
                    this.pos.table.selected_employees = [];
                    $('.searchbox.default-partner-car').text("No Car Selected");
                    var order = this.pos.get_order();
                    order.set_client(null);
                }
            }
        },
    });
    screens.ProductCategoriesWidget.include({
        renderElement: function () {
            var self = this;
            this._super();

            this.el.querySelector('.default-partner-car').addEventListener('click', function () {
                var currentCar = '';
                if (self.pos.table.currentCar) {
                    if (self.pos.table.currentCar['id']) {
                        currentCar = self.pos.table.currentCar;
                    }
                }
                self.gui.show_popup('car_customer_search_widget', {
                    'usr_cars': self.pos.usr_cars,
                    'partners': self.pos.partners,
                    'current_car_id': currentCar,
                    'customerSelected': 'n',
                    'customerSelectedName': 'n',
                });
            });
        },
    });

    chrome.OrderSelectorWidget.include({
        deleteorder_click_handler: function (event, $el) {
            var self = this;
            var order = this.pos.get_order();
            if (!order) {
                return;
            }
            else if (!order.is_empty()) {
                this.gui.show_popup('confirm', {
                    'title': _t('Destroy Current Order ?'),
                    'body': _t('You will lose any data associated with the current order'),
                    confirm: function () {
                        self.pos.table.currentCar = [];
                        self.pos.table.currentCustomer = [];
                        self.pos.table.selected_employees = [];
                        self.pos.delete_current_order();
                    },
                });
            }
            else {
                this.pos.table.currentCar = [];
                this.pos.table.currentCustomer = [];
                this.pos.table.selected_employees = [];
                this.pos.delete_current_order();
            }
        }
    });
    RestaurantFloor.TableWidget.include({
        render_flooar_additional: function () {
            var self = this;
            var methods = $(QWeb.render('SingleTableTSTData', { widget: this }));
            return methods;
        },
        renderElement: function () {
            var self = this;
            this._super();

            var add_widget = this.render_flooar_additional();
            add_widget.insertAfter(this.$el.find(".table-seats"));
        }
    })
    var carCustomerSearchWidget = PosBaseWidget.extend({
        template: 'SelectAndSearchCar',
        init: function (parent, args) {
            this._super(parent, args);
            this.usr_cars = [];
            this.current_car_id = '';
            this.partners = [];
            this.customerSelected = '';
            this.customerSelectedName = '';
        },
        start: function () {
            this._super();
            var self = this;
            this.getParent().on("view_content_has_changed", this, function () {
                self.render_value();
            });
        },
        events: {
            'click .button.cancel': 'click_cancel',
            'click .show-next-twenty': 'next_paging',
            'click .show-last-twenty': 'last_paging',
            'click .clear-search-result': 'clear_search_string',
            'keyup .input-seaarch-car': 'search_partner_table'
        },
        show: function (options) {
            options = options || {};
            this._super(options);
            this.usr_cars = options.usr_cars;
            this.current_car_id = options.current_car_id;
            this.partners = options.partners;
            this.customerSelected = (options.customerSelected == 'n' ? 'n' : options.customerSelected);
            this.customerSelectedName = (options.customerSelectedName == 'n' ? 'n' : options.customerSelectedName);
            this.pagingShowCarJumpCount = 20;
            this.pagingLastShowCar = 0;
            this.pagingNextShowCar = this.pagingShowCarJumpCount;
            this.isSearch = false;
            this.searchResult = 0;
            this.renderElement();
            this.$('.input-seaarch-car').focus();
        },
        close: function () {
            if (this.pos.barcode_reader) {
                this.pos.barcode_reader.restore_callbacks();
            }
        },
        search_partner_table: function (e) {
            var self = this;
            if (e.keyCode == 13) {
                if ($(e.currentTarget).val() == '') {
                    alert("Search String not Provided");
                    return;
                }
                $(".clear-search-result").show();
                var search_str = $(e.currentTarget).val().toLowerCase();
                var results = Array();
                var newThisIs = this;
                self.isSearch = true;

                if(!pos_instance.all_cars_loaded)
                {
                    let ajax_options = {
                        url:'/search/cars',
                        dataType: 'json',
                        data: {search_str: search_str},
                        success: function(data){
                            if(!pos_instance.all_cars_loaded)
                            {
                                $('table.client-cars-list tbody').children().remove();
                                pos_instance.partners = data.partners;
                                pos_instance.db.add_partners(data.partners);

                                results = data.cars;
                                pos_instance.usr_cars = results;
                                pos_instance.db.add_cars(results);
                                console.log(data);

                                self.searchResult = results;
                                var car_list_widget = newThisIs.renderCarsTableList('server', results);
                                if (car_list_widget != 'n') {
                                    $('.client-cars-list tbody').html('');
                                    car_list_widget.appendTo($('.client-cars-list tbody'));
                                }
                                else {
                                    $('.client-cars-list tbody').html('<tr><td colspan="6" style="text-align:center">No Results Found</td></tr>')
                                }
                            }
                        },
                        error: function(er){
                            console.log(er)
                        }
                    }
                    $.ajax(ajax_options)
                }
                else{
                    for (var i in self.pos.usr_cars) {
                        var partner_det = self.pos.db.get_partner_by_id(self.pos.usr_cars[i].partner_id[0]);
                        var partner_phone = '';
                        var car_brand = '';
                        var car_mod = '';
                        if (partner_det) {
                            if (self.pos.db.get_partner_by_id(self.pos.usr_cars[i].partner_id[0]).phone) {
                                partner_phone = self.pos.db.get_partner_by_id(self.pos.usr_cars[i].partner_id[0]).phone.toLowerCase();
                            }
                            else if (self.pos.db.get_partner_by_id(self.pos.usr_cars[i].partner_id[0]).mobile) {
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
                        }
                        else if (self.pos.usr_cars[i].partner_id[1].toLowerCase().indexOf(search_str) !== -1) {
                            results.push(self.pos.usr_cars[i]);
                        }
                        else if (car_mod.indexOf(search_str) !== -1) {
                            results.push(self.pos.usr_cars[i]);
                        }
                        else if (self.pos.usr_cars[i].vehicle_no.toLowerCase().indexOf(search_str) !== -1) {
                            results.push(self.pos.usr_cars[i]);
                        }
                        else if (partner_phone.indexOf(search_str) !== -1) {
                            results.push(self.pos.usr_cars[i]);
                        }
                    }
                    self.searchResult = results;
                    var car_list_widget = newThisIs.renderCarsTableList('server', results);
                    if (car_list_widget != 'n') {
                        $('.client-cars-list tbody').html('');
                        car_list_widget.appendTo($('.client-cars-list tbody'));
                    }
                    else {
                        $('.client-cars-list tbody').html('<tr><td colspan="6" style="text-align:center">No Results Found</td></tr>')
                    }
                }
            }
        },
        last_paging: function (e) {
            if (this.pagingLastShowCar >= this.pagingShowCarJumpCount) {
                this.pagingLastShowCar = this.pagingLastShowCar - this.pagingShowCarJumpCount;
                this.pagingNextShowCar = this.pagingNextShowCar - this.pagingShowCarJumpCount;

                var car_list_widget;
                if (this.isSearch) {
                    car_list_widget = this.renderCarsTableList('server', this.searchResult);
                }
                else {
                    car_list_widget = this.renderCarsTableList('', '');
                }
                if (car_list_widget != 'n') {
                    this.$('.client-cars-list tbody').html('');
                    car_list_widget.appendTo(this.$('.client-cars-list tbody'));
                }
            }
        },
        next_paging: function (e) {
            this.pagingLastShowCar = this.pagingLastShowCar + this.pagingShowCarJumpCount;
            this.pagingNextShowCar = this.pagingNextShowCar + this.pagingShowCarJumpCount;

            var car_list_widget;
            if (this.isSearch == true) {
                car_list_widget = this.renderCarsTableList('server', this.searchResult);
            }
            else {
                car_list_widget = this.renderCarsTableList('', '');
            }
            if (car_list_widget != 'n') {
                this.$('.client-cars-list tbody').html('');
                car_list_widget.appendTo(this.$('.client-cars-list tbody'));
            }
        },
        renderCarsTableList: function (s_type, arr) {
            var self = this;
            var slicedArray, methods;
            if (s_type == "server") {
                slicedArray = arr.slice(this.pagingLastShowCar, this.pagingNextShowCar);
                methods = $(QWeb.render('TableCarsListWidget', { widget: this, slicedArr: slicedArray, s_type: 'server' }));
            }
            else {
                slicedArray = self.pos.usr_cars.slice(this.pagingLastShowCar, this.pagingNextShowCar);
                methods = $(QWeb.render('TableCarsListWidget', { widget: this, slicedArr: slicedArray, s_type: 'local' }));
            }

            methods.on('click', '.set-default-car.button', function () {
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
                    $.each(self.pos.partners, function (index, vals) {
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
            }
            else {
                return 'n';
            }
        },
        clear_search_string: function () {
            var self = this;
            this.isSearch = false;
            $(".clear-search-result").hide();
            $(".input-seaarch-car").val('');
            var car_list_widget = this.renderCarsTableList('', '');
            if (car_list_widget != 'n') {
                this.$('.client-cars-list tbody').html('');
                car_list_widget.appendTo(this.$('.client-cars-list tbody'));
            }
        },
        renderElement: function () {
            var self = this;
            this._super();

            var car_list_widget = this.renderCarsTableList('', '');
            if (car_list_widget != 'n') {
                this.$('.client-cars-list tbody').html('');
                car_list_widget.appendTo(this.$('.client-cars-list tbody'));
            }
        },
        check_car_available: function (car_id) {
            var matched = 0;
            $.each(this.pos.tables_by_id, function (index, vals) {
                if (vals.currentCar) {
                    if (vals.currentCar['id'] == car_id) {
                        matched = 1;
                    }
                }
            });
            return matched;
        },
        click_cancel: function () {
            this.gui.close_popup();
        },
    });
    gui.define_popup({ name: 'car_customer_search_widget', widget: carCustomerSearchWidget });

    var OrderlineSuper = pos_models.Orderline;
    pos_models.Orderline = pos_models.Orderline.extend({
        get_original_discount_price: function (discount, price) {
            var getit = (price / 100) * discount;
            return getit.toFixed(1);
        },
    });

    var _super_Order = pos_models.Order.prototype;
    pos_models.Order = pos_models.Order.extend({
        add_product: function (product, options) {
            var self = this;
            if (product.pos_discount_apply == 'apply_fix') {
                _super_Order.add_product.call(this, product, { discount_fixed: product.product_disc });
            }
            else if (product.pos_discount_apply == 'apply_percentage') {
                _super_Order.add_product.call(this, product, { discount: product.product_disc_percentage });
            }
            else {
                _super_Order.add_product.call(this, product, options);
            }

            var pos_order = self.pos.get_order();
            if (pos_order !== null && pos_order !== undefined) {
                if (!this.pos.apply_tax_id) {
                    $('.order-apply-tax').show();
                    $('.order-tax-free').hide();
                }
                pos_order.is_tax_free_order = true;
                var orderlines = pos_order.get_orderlines();
                $.each(orderlines, function (index) {
                    var line = orderlines[index];
                    line.trigger('change', line);
                })
            }
        }
    });
});
    //# sourceMappingURL=/tst_changes/static/src/js/tst_car_changes_debug.js