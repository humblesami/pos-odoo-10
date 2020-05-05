from odoo import models, api


class TSTMyCars(models.Model):
    _inherit = 'user.cars'

    @api.model
    def search_read(self, domain=None, fields=None, offset=0, limit=None, order=None):
        res = super(TSTMyCars, self).search(domain, offset, limit, order, count=False)
        last_field = fields[len(fields) - 1]
        if len(res) < 200 or last_field != 'loading_data_offline':
            res = super(TSTMyCars, self).search_read(domain, fields, offset=offset or 0, limit=limit or False, order=order or False)
            return res

        cr = self._cr
        query = """
        SELECT user_cars.id,user_cars.vehicle_no,user_cars.car_model, res_partner.name as customer_name,
        res_partner.id as customer_id, user_cars_brands.car_brand 
        FROM public.user_cars 
        inner join public.user_cars_brands on user_cars.car_brand = user_cars_brands.id
        inner join
        (
            select id, name from public.res_partner where customer=true            
        ) res_partner
        on user_cars.partner_id = res_partner.id        
        """

        cr.execute(query)
        cars = cr.dictfetchall()
        for ob in cars:
            ob['car_brand'] = [0, ob['car_brand']]
            ob['partner_id'] = [ob['customer_id'], ob['customer_name']]

        return cars