from datetime import datetime

from odoo import models, fields, api


class ResPartnerTSTInherit(models.Model):
    _inherit = 'res.partner'

    @api.model
    def search_read(self, domain=None, fields=None, offset=0, limit=None, order=None):
        res = super(ResPartnerTSTInherit, self).search(domain, offset, limit, order, count=False)
        last_field = fields[len(fields) - 1]
        if len(res) < 200 or last_field != 'loading_data_offline':
            print ('\n\n\nLoading '+str(len(res))+' customer(s) normally ' + str(datetime.now()))
            res = super(ResPartnerTSTInherit, self).search_read(domain, fields, offset=offset or 0, limit=limit or False, order=order or False)
            print ('Loaded customer normally ' + str(datetime.now()) + '\n\n\n')
            return res
        print ('\n\n\nLoading customer fast ' + str(datetime.now()))
        cr = self._cr
        query = """
                SELECT distinct rp.name as name,rp.id,rp.mobile,rp.barcode,
                rp.street,rp.zip,rp.city,rp.country_id, rp.state_id,
                rp.email, rp.vat, rp.write_date,
                rp.mobile as phone                
                from public.res_partner rp
                join
                (
                    SELECT distinct partner_id FROM public.user_cars                    
                ) as cst on rp.id=cst.partner_id
                where customer=true
        """
        cr.execute(query)
        partners = cr.dictfetchall()
        print ('Loaded customer fast 1 ' + str(datetime.now()) + '\n')
        partner_ids = []
        partners_dict = {}
        for customer in partners:
            for key in customer:
                if not customer.get(key):
                    customer[key] = False
            customer['cars_id'] = []
            customer['write_date'] = customer['write_date'][0:19]
            partner_ids.append(customer['id'])
            partners_dict[customer['id']] = customer

        self.get_related_parents(partners_dict, partner_ids, 'country_id')
        self.get_related_parents(partners_dict, partner_ids, 'state_id')
        self.get_related_parents(partners_dict, partner_ids, 'property_account_position_id')
        self.get_related_children(cr, partners_dict, 'cars_id')

        res = partners
        print ('Loaded customer fast 2 ' + str(datetime.now()) + '\n\n\n')
        return res

    def get_related_parents(self, partners_dict, partner_ids, field_name):
        records = self.env['res.partner'].search_read([('id', 'in', partner_ids), (field_name, '!=', False)], fields=[field_name])
        for ob in records:
            partners_dict[ob['id']][field_name] = [ob[field_name][0], ob[field_name][1]]
        return partners_dict

    def get_related_children(self, cr, partners_dict, field_name):
        query = "select id, partner_id from user_cars"
        cr.execute(query)
        res = cr.dictfetchall()
        for obj in res:
            partners_dict[obj['partner_id']][field_name].append(obj['id'])
        return True

    def write(self, vals):
        phone_number = False
        mobile_number = False
        if vals.get('phone'):
            phone_number = vals.get('phone')
        if vals.get('mobile'):
            mobile_number = vals.get('mobile')
        if phone_number and not mobile_number:
            if not self.mobile:
                vals['mobile'] = phone_number
        if mobile_number and not phone_number:
            if not self.phone:
                vals['phone'] = mobile_number
        res = super(ResPartnerTSTInherit, self).write(vals)
        return res