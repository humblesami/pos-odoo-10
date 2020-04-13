import json

from odoo import http
from odoo.http import request


class TstController(http.Controller):

    @http.route('/search/cars', auth='user')
    def search_string(self, **kw):
        cr = request._cr
        search_str = kw.get('search_str').lower()
        query = """
            SELECT user_cars.id,user_cars.vehicle_no,user_cars.car_model, res_partner.name as customer_name,
            res_partner.id as customer_id, user_cars_brands.car_brand 
            FROM public.user_cars 
            inner join public.user_cars_brands on user_cars.car_brand = user_cars_brands.id
            inner join public.res_partner on user_cars.partner_id = res_partner.id
            WHERE 
            user_cars.vehicle_no ilike '%{}%'
            or user_cars.car_brand in (select id from public.user_cars_brands where car_brand ilike '%{}%')
            or res_partner.id in (select id from public.res_partner where name ilike '%{}%' 
            or mobile ilike '%{}%')
            """
        query = query.format(search_str, search_str, search_str, search_str)
        # print (query)
        cr.execute(query)
        cars = cr.dictfetchall()
        for ob in cars:
            ob['car_brand'] = [0, ob['car_brand']]
            ob['partner_id'] = [ob['customer_id'], ob['customer_name']]

        query = """        
                    SELECT distinct res_partner.name as name,res_partner.id,res_partner.mobile,res_partner.barcode,
                    res_partner.street,res_partner.zip,res_partner.city,res_partner.country_id, res_partner.state_id,
                    res_partner.email, res_partner.vat, res_partner.write_date                    
                    FROM public.user_cars
                    inner join public.user_cars_brands on user_cars.car_brand = user_cars_brands.id
                    inner join public.res_partner on user_cars.partner_id = res_partner.id
                    WHERE 
                    user_cars.vehicle_no ilike '%{}%'
                    or user_cars.car_brand in (select id from public.user_cars_brands where car_brand ilike '%{}%')
                    or res_partner.id in (select id from public.res_partner where name ilike '%{}%' 
                    or mobile ilike '%{}%')
                    """
        query = query.format(search_str, search_str, search_str, search_str)
        # print (query)
        cr.execute(query)
        partners = cr.dictfetchall()

        query = """
        select id,name from res_country rc join (select distinct country_id from res_partner) pc on pc.country_id= rc.id
        """
        cr.execute(query)
        res_countries = cr.dictfetchall()
        default_country = [1, 'US']
        if len(res_countries):
            countries_dict = {}
            for country in res_countries:
                countries_dict[country['id']] = country
            default_country = [res_countries[0]['id'], res_countries[0]['name']]

        for customer in partners:
            if customer.get('country_id'):
                country = countries_dict[customer['country_id']]
                customer['country_id'] = [country['id'], country['name']]
            else:
                customer['country_id'] = default_country

        res = {
            'partners': partners,
            'cars': cars
        }
        res = json.dumps(res)
        return res