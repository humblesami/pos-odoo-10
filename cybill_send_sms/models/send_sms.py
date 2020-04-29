import logging
from odoo import http
from odoo.http import request, serialize_exception as _serialize_exception, content_disposition
from odoo import api, fields, models, tools, _
from datetime import datetime,date,time, timedelta
from urllib import urlencode, quote as quote
import urllib
import requests
import re
from dateutil.relativedelta import relativedelta
from odoo.tools.misc import DEFAULT_SERVER_DATE_FORMAT
_logger = logging.getLogger(__name__)

try:
    from jinja2.sandbox import SandboxedEnvironment
    mako_template_env = SandboxedEnvironment(
        block_start_string="<%",
        block_end_string="%>",
        variable_start_string="${",
        variable_end_string="}",
        comment_start_string="<%doc>",
        comment_end_string="</%doc>",
        line_statement_prefix="%",
        line_comment_prefix="##",
        trim_blocks=True,               # do not output newline after blocks
        autoescape=True,                # XML/HTML automatic escaping
    )
    mako_template_env.globals.update({
        'str': str,
        'quote': quote,
        'urlencode': urlencode,
        'datetime': datetime,
        'len': len,
        'abs': abs,
        'min': min,
        'max': max,
        'sum': sum,
        'filter': filter,
        'reduce': reduce,
        'map': map,
        'round': round,

        'relativedelta': lambda *a, **kw : relativedelta.relativedelta(*a, **kw),
    })
except ImportError:
    _logger.warning("jinja2 not available, templating features will not work!")

class SendSMS(models.Model):
    _name = "send_sms"
    _description = "Send SMS"

    def reminder_sms_cron(self):
        templates = self.env['send_sms'].search([('remind_sms', '=', True)])
        if templates:
            for single in templates:
                pos_order = self.env['cybill.sms.queue'].search([('sms_sent', '=', 'not_send')])
                for order in pos_order:
                    if order.order_id.next_oil_change_date:
                        order_date = datetime.strptime(order.order_id.next_oil_change_date, DEFAULT_SERVER_DATE_FORMAT)
                        today = datetime.today()

                        daysDiff = (order_date - today).days
                        if daysDiff == single.remind_sms_days:
                            body = single.sms_html
                            body = body.replace('{userName}', order.order_id.partner_id.name)
                            body = body.replace('{vehicleNo}', order.order_id.car_id.vehicle_no)
                            body = body.replace('{remondDate}', datetime.strptime(order.order_id.next_oil_change_date, DEFAULT_SERVER_DATE_FORMAT).strftime('%d-%b-%Y'))

                            if order.order_id.partner_id.phone:
                                sms_id = self.env['sms.compose'].create({
                                    'template_id': single.id,
                                    'body_text': body,
                                    'sms_to_lead': "+92"+order.order_id.partner_id.phone
                                    })

                                if sms_id:
                                    self.env['sms.compose'].browse(sms_id.id).send_sms_action_pos(order.order_id.ids)
                                    self.env['cybill.sms.queue'].browse(order.id).write({'sms_sent': 'send'})

    name = fields.Char(required=True, string='Name')
    gateway_id = fields.Many2one('gateway_setup',required=True,string='SMS Gateway')
    model_id = fields.Many2one('ir.model', string='Applies to', help="The kind of document with with this template can be used")
    sms_to = fields.Char(string='To (Mobile)', help="To mobile number (placeholders may be used here)")
    sms_html = fields.Text('Body')
    ref_ir_act_window = fields.Many2one('ir.actions.act_window', 'Sidebar action', readonly=True, copy=False,help="Sidebar action to make this template available on records " "of the related document model")
    ref_ir_value = fields.Many2one('ir.values', 'Sidebar Button', readonly=True, copy=False, help="Sidebar button to open the sidebar action")
    remind_sms = fields.Boolean("Remider SMS")
    remind_sms_days = fields.Integer("Remid SMS Before")
    tobe_send_date = fields.Date("To Be Send Date")

    @api.model
    def send_sms(self, template_id, record_id):
        sms_rendered_content = self.env['send_sms'].render_template(template_id.sms_html, template_id.model_id.model, record_id)
        rendered_sms_to = self.env['send_sms'].render_template(template_id.sms_to, template_id.model_id.model, record_id)
        self.send_sms_link(sms_rendered_content,rendered_sms_to,record_id,template_id.model_id.model,template_id.gateway_id)

    def send_sms_link(self,sms_rendered_content,rendered_sms_to,record_id,model,gateway_url_id):
        sms_rendered_content = sms_rendered_content.encode('ascii', 'ignore')
        sms_rendered_content_msg = urllib.quote_plus(sms_rendered_content)
        if rendered_sms_to:
            rendered_sms_to = rendered_sms_to.encode('ascii', 'ignore')
            rendered_sms_to = re.sub(r' ', '', rendered_sms_to)
            if '+' in rendered_sms_to:
                rendered_sms_to = rendered_sms_to.replace('+', '')
            if '-' in rendered_sms_to:
                rendered_sms_to = rendered_sms_to.replace('-', '')

        if rendered_sms_to:
            send_url = gateway_url_id.gateway_url
            send_link = send_url.replace('{mobile}',rendered_sms_to).replace('{message}',sms_rendered_content_msg)
            response = requests.request("GET", url = send_link).text
            self.env['sms_track'].sms_track_create(record_id, sms_rendered_content, rendered_sms_to, response, model, gateway_url_id.id )
            if model != 'gateway_setup':
                self.env['mail.message'].create({
                'author_id': http.request.env.user.partner_id.id,
                'date': datetime.today().strftime('%Y-%m-%d %H:%M:%S'),
                'model': model,
                'res_id': record_id,
                'message_type': 'comment',
                'body': '<b>SMS: </b>'+sms_rendered_content,
                'reply_to': http.request.env.user.email or '',
                })
            return response

    def render_template(self, template, model, res_id):
        """Render the given template text, replace mako expressions ``${expr}``
           with the result of evaluating these expressions with
           an evaluation context containing:

                * ``user``: browse_record of the current user
                * ``object``: browse_record of the document record this sms is
                              related to
                * ``context``: the context passed to the sms composition wizard

           :param str template: the template text to render
           :param str model: model name of the document record this sms is related to.
           :param int res_id: id of document records those sms are related to.
        """
        template = mako_template_env.from_string(tools.ustr(template))
        user = self.env.user
        record = self.env[model].browse(res_id)

        variables = {
            'user': user
        }
        variables['object'] = record
        try:
            render_result = template.render(variables)
        except Exception:
            _logger.error("Failed to render template %r using values %r" % (template, variables))
            render_result = u""
        if render_result == u"False":
            render_result = u""

        return render_result
    @api.multi
    def create_action(self):
        action_obj = self.env['ir.actions.act_window']
        IrValuesSudo = self.env['ir.values']
        data_obj = self.env['ir.model.data']
        view = self.env.ref('cybill_send_sms.sms_compose_wizard_form')
        src_obj = self.model_id.model
        button_name = _('SMS Send (%s)') % self.name
        action = action_obj.create({
            'name': button_name,
            'type': 'ir.actions.act_window',
            'res_model': 'sms.compose',
            'src_model': src_obj,
            'view_type': 'form',
            'context': "{'default_template_id' : %d, 'default_use_template': True}" % (self.id),
            'view_mode': 'form,tree',
            'view_id': view.id,
            'target': 'new',
            'auto_refresh': 1})
        ir_value = IrValuesSudo.create({
            'name': button_name,
            'model': src_obj,
            'key2': 'client_action_multi',
            'value': "ir.actions.act_window,%s" % action.id})
        self.write({
            'ref_ir_act_window': action.id,
            'ref_ir_value': ir_value.id,
        })
        return True

    @api.multi
    def unlink_action(self):
        for template in self:
            if template.ref_ir_act_window:
                template.ref_ir_act_window.sudo().unlink()
            if template.ref_ir_value:
                template.ref_ir_value.sudo().unlink()
        return True

class CybillSMSQueue(models.Model):
    _name = "cybill.sms.queue"
    _description = "SMS Queue"

    def fill_sms_queue(self):
        get_all = self.env['cybill.sms.queue'].search([])
        list = []
        if get_all:
            for single in get_all:
                list.append(single.order_id.id)

        templates = self.env['send_sms'].search([('remind_sms', '=', True)], limit=1)
        remind_days = 0
        if templates:
            remind_days = templates.remind_sms_days
        get_orders = self.env['pos.order'].search([('id', 'not in', list)])
        if get_orders:
            for single in get_orders:
                order_date = datetime.strptime(single.next_oil_change_date, DEFAULT_SERVER_DATE_FORMAT)
                expected_date = order_date - timedelta(days=remind_days)

                self.env['cybill.sms.queue'].create({
                    'order_id': single.id,
                    'when_to_send': expected_date,
                    'sms_sent': 'not_send',
                    })

    order_id = fields.Many2one("pos.order", string="Order ID")
    when_to_send = fields.Date("When To Send")
    sms_sent = fields.Selection([('not_send', 'Not Sent'),('send','Sent')],string="SMS Status", default='not_send')