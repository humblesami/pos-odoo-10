import json

from odoo import http
from odoo.http import request


class TstController(http.Controller):

    @http.route('/set/password', auth='public')
    def index(self):
        return 'Hello'

    @http.route('/search/cars', auth='user')
    def search_string(self, **kw):
        cr = request._cr
        search_str = kw.get('search_str').lower()
        query = """
            SELECT user_cars.id,user_cars.vehicle_no,user_cars.car_model,res_partner.name as customer_name
            ,res_partner.id as customer_id,res_partner.phone,user_cars_brands.car_brand 
            FROM public.user_cars 
            inner join public.user_cars_brands on user_cars.car_brand = user_cars_brands.id
            inner join public.res_partner on user_cars.partner_id = res_partner.id
            WHERE 
            user_cars.vehicle_no ilike '%{}%'
            or user_cars.car_brand in (select id from public.user_cars_brands where car_brand ilike '%{}%')
            or res_partner.id in (select id from public.res_partner where name ilike '%{}%' 
            or lower(phone) like '%{}%')
            """
        query = query.format(search_str, search_str, search_str, search_str)
        print (query)
        cr.execute(query)
        res = cr.dictfetchall()
        res = json.dumps(res)
        return res