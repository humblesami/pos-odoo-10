from odoo import models, fields, exceptions, api, tools, _
from odoo.exceptions import UserError
from datetime import datetime
from odoo.tools import DEFAULT_SERVER_DATETIME_FORMAT


class TSTMyCars(models.Model):
    _name = 'user.cars'
    _sql_constraints = [('vehicle_no_unique', 'unique (vehicle_no)', 'Vehicle Number already exists!')]

    def read(self, fields=None, load='_classic_read'):
        last_field = fields[len(fields) - 1]
        if last_field != 'tst_pos_data':
            res = super(TSTMyCars, self).read(fields=fields, load=load)
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

    @api.model
    def name_search(self, name, args=None, operator='ilike', limit=100):
        args = args or []
        domain = []
        if name:
            domain = ['|', ('name', operator, name), ('vehicle_no', operator, name)]
        pos = self.search(domain + args, limit=limit)
        return pos.name_get()

    @api.multi
    def name_get(self):
        result = []
        for record in self:
            name = record.name
            name = "%s / %s" % (name, record.vehicle_no)
            result.append((record.id, name))
        return result

    @api.model
    def create(self, vals):
        vals['name'] = self.env['ir.sequence'].next_by_code('user.cars') or '/'
        return super(TSTMyCars, self).create(vals)

    @api.multi
    def write(self, vals):
        if 'partner_id' in vals:
            self.env['user.cars.transfer.history'].create({
                'partner_id': vals['partner_id'],
                'car_id': self.id
                })
        return super(TSTMyCars, self).write(vals)

    def create_car(self, vals):
        search_result = 0
        if 'vehicle_no' in vals:
            search_vno = self.env['user.cars'].search_count([('vehicle_no','=',vals.get('vehicle_no'))])
            if search_vno:
                search_result = 1

        if search_result == 0:
            new_vals = {
                'car_brand': int(vals.get('car_brand')),
                'car_model': vals.get('car_model'),
                'vehicle_no': vals.get('vehicle_no'),
                'partner_id': int(vals.get('partner_id')),
                'car_readaing_per_day': int(vals.get('car_readaing_per_day')),
                'oil_change_after_readaing': int(vals.get('oil_change_after_readaing'))
                }

            rec = self.env['user.cars'].create(new_vals)

            if rec:
                customer_cred = {}
                customer_cred[0] = rec.partner_id.id
                customer_cred[1] = rec.partner_id.name
                returnVals = {
                    'id': rec.id,
                    'name': rec.name,
                    'car_brand': rec.car_brand.id,
                    'car_model': rec.car_model,
                    'vehicle_no': rec.vehicle_no,
                    'car_status': rec.car_status,
                    'partner_id': customer_cred,
                    'car_readaing_per_day': rec.car_readaing_per_day,
                    'oil_change_after_readaing': rec.oil_change_after_readaing
                    }
                return returnVals
        else:
            return "Vehicle No Already Exist"

    @api.multi
    def search_string(self, vals):
        if 'search_str' in vals:
            result = self.env.cr.execute("""SELECT user_cars.id,user_cars.vehicle_no,user_cars.car_model,res_partner.name as customer_name,res_partner.id as customer_id,res_partner.phone,user_cars_brands.car_brand 
                                    FROM public.user_cars 
                                    inner join public.user_cars_brands on user_cars.car_brand = user_cars_brands.id
                                    inner join public.res_partner on user_cars.partner_id = res_partner.id
                                    WHERE lower(user_cars.vehicle_no) like '%""" + str(vals['search_str']).lower() + """%' or lower(user_cars.car_model) like '%""" + str(vals['search_str']).lower() + """%' 
                                     or user_cars.car_brand in (select id from public.user_cars_brands where lower(car_brand) like '%""" + str(vals['search_str']).lower() + """%')
                                     or res_partner.id in (select id from public.res_partner where lower(name) like '%""" + str(vals['search_str']).lower() + """%' or lower(phone) like '%""" + str(vals['search_str']).lower() + """%')""")
            return self.env.cr.dictfetchall()

    @api.depends('partner_id')
    def get_partner_mobile(self):
        for rec in self:
            if rec.partner_id:
                rec.partner_mobile = rec.partner_id.phone

    name = fields.Char("Car ID")
    car_brand = fields.Many2one("user.cars.brands", string="Car Brand", required=True, default='')
    car_model = fields.Char("Car Model")
    vehicle_no = fields.Char("Vehicle #", required=True)
    car_status = fields.Selection([('active', 'Activate'),('deactive','Deactivate')], string="Car Status", required=True, default='active')
    partner_id = fields.Many2one('res.partner', 'Customer', domain="[('customer','=',True)]", required=True)
    partner_mobile = fields.Char('Customer Mobile', compute=get_partner_mobile, store=True)
    car_readaing_per_day = fields.Integer('Car Reading Per Day (KM)')
    oil_change_after_readaing = fields.Integer('Oil Change After Reading')
    per_day_reading = fields.One2many("user.cars.readings",'car_id',string="Car Readings")
    pos_order = fields.One2many("pos.order", 'car_id', string="Car Orders")
    transfer_history = fields.One2many("user.cars.transfer.history", 'car_id', string="Car Transfer History")


class TSTCarTransferHistory(models.Model):
    _name = 'user.cars.transfer.history'

    partner_id = fields.Many2one('res.partner', 'Previous Customer Name')
    car_id = fields.Many2one('user.cars', 'Car ID')


class TSTUserCarsAddBrands(models.Model):
    _name = 'user.cars.brands'

    @api.multi
    def name_get(self):
        result = []
        for record in self:
            name = record.car_brand
            name = "%s" % (name)
            result.append((record.id, name))
        return result

    car_brand = fields.Char("Brand")


class TSTCarReadings(models.Model):
    _name = "user.cars.readings"
    _rec_name = 'car_id'

    per_day_reading = fields.Float("Car Reading Per Days")
    current_readaing = fields.Float("Current Reading")
    next_oil_change_km = fields.Float("Next Oil Change KM")
    next_oil_change_date = fields.Date("Next Oil Change Date")
    car_per_day_read_expect = fields.Integer("Expected Car Reading After KM")
    car_id = fields.Many2one("user.cars", "Car ID")
    pos_order_id = fields.Many2one("pos.order", string="POS Order")


class TSTTableEmployees(models.Model):
    _name = "tst.table.employees"

    emp_id = fields.Many2one("hr.employee", string="Employee Name")
    pos_order_id = fields.Many2one("pos.order", string="POS Order ID")


class TSTHrEmployeeInherit(models.Model):
    _inherit = "hr.employee"

    is_dock_user = fields.Boolean("Is Dock Worker")


class TSTCaMaintainenceHistoy(models.Model):
    _name = "tst.car.maintain.history"

    @api.multi
    def print_report(self):
        data = { 'vehicle_no': self.car_id.id, 'show_price_flag': self.show_price_flag }
        return self.env['report'].get_action([], 'tst_changes.tst_report_saledetails', data=data)

    car_id = fields.Many2one("user.cars", string="Select Car")
    show_price_flag = fields.Selection([('show_prices','Show Prices'),('hide_prices','Hide Prices')], string="Show Prices", default='show_prices')


class ReportSaleDetails(models.AbstractModel):
    _name = 'report.tst_changes.tst_report_saledetails'

    @api.model
    def get_sale_details(self, vehicle_no=False, price_flag=False):
        car_detail = self.env['user.cars'].search([('id', '=', vehicle_no)])
        get_car_orders = self.env['pos.order'].search([('car_id', '=', vehicle_no)], limit=0)
        total = 0.0
        products_sold = {}
        taxes = {}
        user_currency = self.env.user.company_id.currency_id
        for order in get_car_orders:
            if user_currency != order.pricelist_id.currency_id:
                total += order.pricelist_id.currency_id.compute(order.amount_total, user_currency)
            else:
                total += order.amount_total
            currency = order.session_id.currency_id
            for line in order.lines:
                key = (line.product_id, line.price_unit, line.discount, order.date_order)
                products_sold.setdefault(key, 0.0)
                products_sold[key] += line.qty

                if line.tax_ids_after_fiscal_position:
                    line_taxes = line.tax_ids_after_fiscal_position.compute_all(line.price_unit * (1-(line.discount or 0.0)/100.0), currency, line.qty, product=line.product_id, partner=line.order_id.partner_id or False)
                    for tax in line_taxes['taxes']:
                        taxes.setdefault(tax['id'], {'name': tax['name'], 'total':0.0})
                        taxes[tax['id']]['total'] += tax['amount']

        st_line_ids = self.env["account.bank.statement.line"].search([('pos_statement_id', 'in', get_car_orders.ids)]).ids
        if st_line_ids:
            self.env.cr.execute("""
                        SELECT aj.name, sum(amount) total
                        FROM account_bank_statement_line AS absl,
                             account_bank_statement AS abs,
                             account_journal AS aj
                        WHERE absl.statement_id = abs.id
                            AND abs.journal_id = aj.id
                            AND absl.id IN %s
                        GROUP BY aj.name
                    """, (tuple(st_line_ids),))
            payments = self.env.cr.dictfetchall()
        else:
            payments = []

        returnGet =  {
                    'car_id': car_detail.name,
                    'vehicle_no': car_detail.vehicle_no,
                    'customer_name': car_detail.partner_id.name,
                    'currency_precision': user_currency.decimal_places,
                    'total_paid': user_currency.round(total),
                    'payments': payments,
                    'company_name': self.env.user.company_id.name,
                    'taxes': taxes.values(),
                    'price_flag': price_flag,
                    'products': sorted([{
                        'product_id': product.id,
                        'product_name': product.name,
                        'code': product.default_code,
                        'quantity': qty,
                        'price_unit': price_unit,
                        'discount': discount,
                        'uom': product.uom_id.name,
                        'category': product.pos_categ_id.name,
                        'order_date': datetime.strptime(date_order, DEFAULT_SERVER_DATETIME_FORMAT).strftime('%d-%b-%Y'),
                        } for (product, price_unit, discount, date_order), qty in products_sold.items()], key=lambda l: l['category'])
                    }

        return returnGet

    @api.multi
    def render_html(self, docids, data=None):
        data = dict(data or {})
        data.update(self.get_sale_details(data['vehicle_no'], data['show_price_flag']))
        return self.env['report'].render('tst_changes.tst_report_saledetails', data)