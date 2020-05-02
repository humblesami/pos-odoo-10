from functools import partial
from odoo import models, fields, api
from odoo.exceptions import UserError


class ResPartnerTSTInherit(models.Model):
    _inherit = 'res.partner'

    cars_id = fields.One2many("user.cars", 'partner_id')

    # def search(self, args, offset=0, limit=None, order=None, count=False):
    #     limit = 100
    #     res = super (ResPartnerTSTInherit, self).search(args, offset=offset, limit=limit, order=order, count=count)
    #     return res

    def read(self, fields=None, load='_classic_read'):
        last_field = fields[len(fields) - 1]
        if last_field != 'tst_pos_data':
            res = super(ResPartnerTSTInherit, self).read(fields=fields, load=load)
            return res
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
        return res

    def create(self, vals):
        res = super(ResPartnerTSTInherit, self).create

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
            partners_dict[obj['partner_id']]['cars_id'].append(obj['id'])
        return True

    @api.constrains('mobile','phone')
    def _check_number_format(self):
        if self.mobile:
            if self.search_count([('mobile','=',self.mobile)]) > 1:
                raise ValueError('Mobile No Already Exists')

        if self.phone:
            if len(str(self.phone)) != 11:
                raise ValueError("Phone No Must not be greater than 11 digits.")
            if self.search_count([('phone','=',self.phone)]) > 1:
                raise ValueError('Phone No Already Exists')

    def write(self, vals):
        res = super(ResPartnerTSTInherit, self).write(vals)
        return res


class TSTInheritPosOrderLine(models.Model):
    _inherit = "pos.order.line"
    discount_fixed = fields.Float(default=0)
    discount_total = fields.Float(default=0)

    def get_original_discount_price(self):
        if self.price_unit and self.discount:
            getit = (self.price_unit / 100) * self.discount
            return getit


class TSTInheritPosOrder(models.Model):
    _inherit = "pos.order"

    discount_fixed = fields.Float(default=0)
    discount_total = fields.Float(default=0)

    employees_ids = fields.One2many("tst.table.employees","pos_order_id", string="Working Employees")
    car_id = fields.Many2one("user.cars", string="Selected Car")
    per_day_reading = fields.Float("Car Reading Per Days")
    current_readaing = fields.Float("Current Reading")
    next_oil_change_km = fields.Float("Next Oil Change KM")
    next_oil_change_date = fields.Date("Next Oil Change Date")
    car_per_day_read_expect = fields.Integer("Expected Car Reading After KM")
    order_id = fields.Many2one("pos.order", string="POS Order")
    message_sent = fields.Boolean("Message Sent")

    @api.model
    def create(self, values):
        if values.get('session_id'):
            # set name based on the sequence specified on the config
            session = self.env['pos.session'].browse(values['session_id'])
            values['name'] = session.config_id.sequence_id._next()
            values.setdefault('pricelist_id', session.config_id.pricelist_id.id)
        else:
            # fallback on any pos.order sequence
            values['name'] = self.env['ir.sequence'].next_by_code('pos.order')

        getCreate = super(TSTInheritPosOrder, self).create(values)
        if values['reading_id']:
            self.env['user.cars.readings'].browse(values['reading_id']).write({ 'pos_order_id':getCreate.id })
        sms_template = None
        #sms_template = self.env['send_sms'].search([('name','=','POS Order Creation')], limit=1)
        if sms_template:
            body = sms_template.sms_html

            customer = self.env['res.partner'].browse(values['partner_id'])
            if customer:
                if customer.phone:
                    body = body.replace('{userName}',customer.name)
                    phoneNum = '+92' + str(customer.phone)[1:]
                    sms_id = self.env['sms.compose'].create({
                                    'template_id': sms_template.id,
                                    'body_text': body,
                                    'sms_to_lead': phoneNum
                                    })

                    if sms_id:
                        self.env['sms.compose'].browse(sms_id.id).send_sms_action_pos(getCreate.ids)

        return getCreate

    @api.multi
    def get_pos_order(self, vals):
        html = ""
        if 'order_id' in vals:
            html = "<tr class='readings-order-table-row'><td colspan='6'><table class='sub-table-table' style='width:100%'>"
            html += "<tr><th class='text-center'>Product Name</th><th class='text-center'>Quantity</th></tr>"
            pos_order = self.env['pos.order'].browse(int(vals['order_id']))
            if pos_order:
                for line in pos_order.lines:
                    html += "<tr><td class='text-center'>"+ line.product_id.name +"</td><td class='text-center'>"+ str(line.qty) +"</td></tr>"
            html += "</table><tr><td>"
            return html
        if html == '':
            return False

    @api.model
    def _order_fields(self, ui_order):
        process_line = partial(self.env['pos.order.line']._order_line_fields)
        terms = []

        if 'selected_employees' in ui_order:
            for emp in ui_order['selected_employees']:
                vals = {}
                vals['emp_id'] = emp
                terms.append((0, 0, vals))

            values = {}
            values['per_day_reading'] = ui_order['car_reading']
            values['current_readaing'] = ui_order['car_current_reading']
            values['next_oil_change_km'] = ui_order['next_oil_change']
            values['next_oil_change_date'] = ui_order['next_oil_change_date']
            values['car_per_day_read_expect'] = ui_order['car_per_day_read_expect'] if 'car_per_day_read_expect' in ui_order else ''
            values['car_id'] = ui_order['selected_car'] if 'selected_car' in ui_order else ''
            values['pos_order_id'] = False

            reading_id = self.env['user.cars.readings'].create(values)

        return {
            'name': ui_order['name'],
            'user_id': ui_order['user_id'] or False,
            'session_id': ui_order['pos_session_id'],
            'lines': [process_line(l) for l in ui_order['lines']] if ui_order['lines'] else False,
            'pos_reference': ui_order['name'],
            'partner_id': ui_order['partner_id'] or False,
            'date_order': ui_order['creation_date'],
            'fiscal_position_id': ui_order['fiscal_position_id'],
            'employees_ids': terms,
            'car_id': ui_order['selected_car'] if 'selected_car' in ui_order else '',
            'per_day_reading': ui_order['car_reading'] if 'car_reading' in ui_order else '',
            'current_readaing': ui_order['car_current_reading'] if 'car_current_reading' in ui_order else '',
            'next_oil_change_km': ui_order['next_oil_change'] if 'next_oil_change' in ui_order else '',
            'next_oil_change_date': ui_order['next_oil_change_date'] if 'next_oil_change_date' in ui_order else '',
            'reading_id': False
        }


class TSTPOSConfigInherit(models.Model):
    _inherit = "pos.config"

    reciept_logo = fields.Binary('Logo')


class DNSSurveyProductTemplateInherit(models.Model):
    _inherit = "product.template"

    @api.multi
    @api.depends('list_price','product_disc')
    def compute_discount_percentage(self):
        percent = 0
        for rec in self:
            if rec.list_price < rec.product_disc:
                raise UserError("Discount Price is greater then Actual Price")
            if rec.product_disc:
                percent = (rec.product_disc / rec.list_price) * 100

            rec.product_disc_percentage = percent

    @api.multi
    @api.depends('list_price', 'product_disc')
    @api.onchange('product_disc_percent')
    def onchange_product_disc_percent(self):
        if self.product_disc_percent:
            self.product_disc = (self.product_disc_percent/100)*self.list_price

    product_disc = fields.Float(string="Set Discount In RS")
    product_disc_percent = fields.Float(string="Set Discount In %")
    product_disc_percentage = fields.Float(string="Discount in %", digits=(16, 2), store=True, compute=compute_discount_percentage)
    pos_discount_apply = fields.Selection([('apply_percentage','Apply Percentage Discount'),('apply_fix','Apply Fix Discount')], string="POS Apply Discount",
                                            default="apply_fix")