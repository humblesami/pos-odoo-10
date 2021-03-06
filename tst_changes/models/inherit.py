from dateutil.parser import parser

from odoo import models, fields, exceptions, api, tools, _
from odoo.exceptions import UserError, ValidationError
from functools import partial
import pytz
from datetime import timedelta

class ResPartnerTSTInherit(models.Model):
    _inherit = 'res.partner'

    cars_id = fields.One2many("user.cars", 'partner_id', "Customer Cars")

class TSTInheritPosOrderLine(models.Model):
    _inherit = "pos.order.line"

    def get_original_discount_price(self):
        if self.price_unit and self.discount:
            getit = (self.price_unit / 100) * self.discount
            return getit

class TSTInheritPosOrder(models.Model):
    _inherit = "pos.order"

    employees_ids = fields.One2many("tst.table.employees","pos_order_id", string="Working Employees")
    car_id = fields.Many2one("user.cars", string="Selected Car")
    per_day_reading = fields.Float("Car Reading Per Days")
    current_reading = fields.Float("Current Reading")
    next_oil_change_km = fields.Float("Next Oil Change KM")
    next_oil_change_date = fields.Date("Next Oil Change Date")
    car_per_day_read_expect = fields.Integer("Expected Car Reading After KM")
    order_id = fields.Many2one("pos.order", string="POS Order")

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
        reading = self.env['user.cars.readings'].browse(values['reading_id'])
        reading.pos_order_id = getCreate.id
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
        values = {}
        values['per_day_reading'] = ui_order.get('per_day_reading') or False
        values['current_reading'] = ui_order.get('current_reading') or False
        values['next_oil_change_km'] = ui_order.get('next_oil_change') or False
        values['next_oil_change_date'] = ui_order.get('next_oil_change_date') or False
        values['car_per_day_read_expect'] = ui_order.get('car_per_day_read_expect') or False
        values['car_id'] = ui_order.get('selected_car') or False
        values['pos_order_id'] = False
        reading_id = None
        if 'selected_employees' in ui_order:
            for emp in ui_order['selected_employees']:
                vals = {}
                vals['emp_id'] = emp
                terms.append((0, 0, vals))
            try:
                if values.get('car_id'):
                    if values.get('next_oil_change_date'):
                        try:
                            values['next_oil_change_date'] = parser.parse(values.get('next_oil_change_date'))
                            values['next_oil_change_date'] = values['next_oil_change_date'].date()
                            values['next_oil_change_date'] = str(values['next_oil_change_date'])
                        except:
                            pass
                    reading_id = self.env['user.cars.readings'].create(values)
                    cars_model = self.env['user.cars']
                    res = cars_model.search([('id', '=', values['car_id'])]).read()
                    if len(res):
                        res = res[0]
                        car_values = {}
                        field_count = 0
                        if not res.get('car_reading_per_day'):
                            if values.get('per_day_reading'):
                                car_values['car_reading_per_day'] = values['per_day_reading']
                                field_count += 1
                        if not res.get('oil_change_after_reading'):
                            if values.get('next_oil_change_date'):
                                car_values['oil_change_after_reading'] = values['next_oil_change_date']
                                field_count += 1
                        if field_count:
                            cars_model.write(car_values)
            except Exception as e:
                print (str(e))
                raise ValidationError(e)
        res = {
            'name': ui_order['name'],
            'user_id': ui_order['user_id'] or False,
            'session_id': ui_order['pos_session_id'],
            'lines': [process_line(l) for l in ui_order['lines']] if ui_order['lines'] else False,
            'pos_reference': ui_order['name'],
            'partner_id': ui_order['partner_id'] or False,
            'date_order': ui_order['creation_date'],
            'fiscal_position_id': ui_order['fiscal_position_id'],
            'employees_ids': terms,
            'amount_tax': ui_order.get('amount_tax') or False,
            'amount_total': ui_order.get('amount_total') or False,
            'amount_paid': ui_order.get('amount_paid') or False,
            'amount_return': ui_order.get('amount_return') or False,
            'car_id': values['car_id'],
            'per_day_reading': values['per_day_reading'],
            'current_reading': values['current_reading'],
            'car_per_day_read_expect': values['car_per_day_read_expect'],
            'next_oil_change_km': values['next_oil_change_km'],
            'next_oil_change_date': values['next_oil_change_date'],
            'reading_id': reading_id.id if reading_id else False
        }
        return res


class TSTPOSConfigInherit(models.Model):
    _inherit = "pos.config"

    reciept_logo = fields.Binary('Logo')


class TSTPOSResPartner(models.Model):
    _inherit = "res.partner"

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
