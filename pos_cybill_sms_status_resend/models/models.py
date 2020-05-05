import re
import urllib
from datetime import datetime

import lxml
import requests

from odoo import models, api, fields, http


class SMSTrack(models.Model):
    _inherit = "sms_track"
    success = fields.Boolean(default=True, readonly=True)
    record_id = fields.Integer('Record Number', readonly=True)
    mobile_no = fields.Char('Mobile No.', readonly=False)

    def resend_message(self):
        send_url = self.gateway_id.gateway_url
        send_link = send_url.replace('{mobile}', self.mobile_no).replace('{message}', self.message_id)
        response = requests.request("GET", url=send_link).text
        response = self.get_text_from_html(response)
        success = False
        if 'SMS Sent Success' not in response:
            response = 'Not sent again'
        else:
            success = True
        res = self.write({'response_id': response, 'success': success})

        if success:
            message = {
                'author_id': http.request.env.user.partner_id.id,
                'date': datetime.today().strftime('%Y-%m-%d %H:%M:%S'),
                'model': self.model_id,
                'res_id': self.record_id,
                'message_type': 'comment',
                'body': '<b>SMS: </b>' + self.message_id,
                'reply_to': http.request.env.user.email or '',
            }
            res = self.env['mail.message'].create(message)
        return res

    def get_text_from_html(self, html_str):
        html = lxml.html.fromstring(html_str)
        contents = html.text_content().strip()
        return contents


class SendSMS(models.Model):
    _inherit = 'send_sms'

    @api.model
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
            response = self.get_text_from_html(response)
            if 'SMS Sent Successfully' in response:
                vals = {
                    'model_id': model,
                    'mobile_no': rendered_sms_to,
                    'message_id': sms_rendered_content,
                    'response_id': response,
                    'record_id': record_id,
                    'gateway_id': gateway_url_id.id,
                    'success': True
                }
                self.env['sms_track'].create(vals)
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
            else:
                vals = {
                    'model_id': model,
                    'mobile_no': rendered_sms_to,
                    'message_id': sms_rendered_content,
                    'response_id': response,
                    'record_id': record_id,
                    'gateway_id': gateway_url_id.id,
                    'success': False
                }
                self.env['sms_track'].create(vals)
            return response

    def get_text_from_html(self, html_str):
        html = lxml.html.fromstring(html_str)
        contents = html.text_content().strip()
        return contents

    def resend(self, model, record_id, sms_rendered_content):
        self.env['mail.message'].create({
            'author_id': http.request.env.user.partner_id.id,
            'date': datetime.today().strftime('%Y-%m-%d %H:%M:%S'),
            'model': model,
            'res_id': record_id,
            'message_type': 'comment',
            'body': '<b>SMS: </b>' + sms_rendered_content,
            'reply_to': http.request.env.user.email or '',
        })


class PosOrder(models.Model):
    _inherit = 'pos.order'

    @api.model
    def create(self, vals):
        res = super(PosOrder, self).create(vals)
        sms_template = self.env['send_sms'].search([('name','=','POS Order Creation')], limit=1)
        if sms_template:
            body = sms_template.sms_html

            customer = self.env['res.partner'].browse(vals['partner_id'])
            if customer:
                if customer.phone:
                    body = body.replace('{userName}', customer.name)
                    phoneNum = '+92' + str(customer.phone)[1:]
                    sms_id = self.env['sms.compose'].create({
                        'template_id': sms_template.id,
                        'body_text': body,
                        'sms_to_lead': phoneNum
                    })

                    if sms_id:
                        self.env['sms.compose'].browse(sms_id.id).send_sms_action_pos(res.ids)
        return res


class GateWaySetup(models.Model):
    _inherit = "gateway_setup"

    @api.one
    def sms_test_action(self):
        active_model = 'gateway_setup'
        message = self.env['send_sms'].render_template(self.message, active_model, self.id)
        mobile_no = self.env['send_sms'].render_template(self.mobile, active_model, self.id)
        sala = self.env['send_sms']
        response = sala.send_sms_link(message, mobile_no,self.id,active_model,self)
        return True