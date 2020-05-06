odoo.define('pos_fast_load',function(require) {
    "use strict";
    var core = require('web.core');
    var _t = core._t;
    var Model = require('web.Model');
    var models = require('point_of_sale.models');
    models.PosModel = models.PosModel.extend({
        //load all data offline efficiently
        //just added 'loading_data_offline' field which changes the search_read method
        load_server_data: function(){
            var self = this;
            var loaded = new $.Deferred();
            var progress = 0;
            var progress_step = 1.0 / self.models.length;
            var tmp = {}; // this is used to share a temporary state between models loaders

            function load_model(index){
                if(index >= self.models.length){
                    loaded.resolve();
                }else{
                    var model = self.models[index];
                    var loader = self.chrome;
                    var loader_label = _t('Loading')+' '+(model.label || model.model || '');
                    loader.loading_message(loader_label, progress);
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
                        if(model.model == 'res.partner' || model.model == 'user.cars')
                        {
                            if(model.fields[model.fields-1] != 'loading_data_offline')
                            {
                                model.fields.push('loading_data_offline');
                            }
                        }
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
                    }
                    else if( model.loaded ){
                        try{    // catching exceptions in model.loaded(...)
                            $.when(model.loaded(self,tmp))
                                .then(  function(){ load_model(index +1); },
                                        function(err){ loaded.reject(err); });
                        }catch(err){
                            loaded.reject(err);
                        }
                    }
                    else{
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
        }
    });
})