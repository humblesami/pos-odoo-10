from openerp import models, fields, api, _
from openerp.tools import float_is_zero
import time

class PosConfig(models.Model):
    _inherit = 'pos.config'

    enable_rounding = fields.Boolean("Rounding")
    rounding_options = fields.Selection([("digits", 'Digits'), ('points','Points'),], string='Rounding Options', default='digits')
    rounding_journal_id = fields.Many2one('account.journal',"Rouding Payment Method")

    def _order_fields(self, ui_order):
        res = super(pos_order, self)._order_fields(ui_order)
        res.update({
            'is_rounding': ui_order.get('is_rounding') or False,
            'rounding_option': ui_order.get('rounding_option') or False,
        })
        return res


class pos_order(models.Model):
    _inherit = "pos.order"

    is_rounding = fields.Boolean("Is Rounding")
    rounding_option = fields.Char("Rounding Option")
    rounding = fields.Float(string='Rounding', digits=0,readonly=True)

    @api.model
    def _process_order(self, pos_order):
        prec_acc = self.env['decimal.precision'].precision_get('Account')
        pos_session = self.env['pos.session'].browse(pos_order['pos_session_id'])
        if pos_session.state == 'closing_control' or pos_session.state == 'closed':
            pos_order['pos_session_id'] = self._get_valid_session(pos_order).id
        order = self.create(self._order_fields(pos_order))
        if pos_order.get('rounding'):
            order.write({'rounding': pos_order['rounding']})
            rounding_journal_id = order.session_id.config_id.rounding_journal_id
            if rounding_journal_id:
                order.add_payment({
                    'amount':pos_order['rounding'] * -1,
                    'payment_date': time.strftime('%Y-%m-%d %H:%M:%S'),
                    'payment_name': _('Rounding'),
                    'journal': rounding_journal_id.id,
                })
        journal_ids = set()
        for payments in pos_order['statement_ids']:
            if not float_is_zero(payments[2]['amount'], precision_digits=prec_acc):
                order.add_payment(self._payment_fields(payments[2]))
            journal_ids.add(payments[2]['journal_id'])

        if pos_session.sequence_number <= pos_order['sequence_number']:
            pos_session.write({'sequence_number': pos_order['sequence_number'] + 1})
            pos_session.refresh()

        if not float_is_zero(pos_order['amount_return'], prec_acc):
            cash_journal_id = pos_session.cash_journal_id.id
            if not cash_journal_id:
                cash_journal = self.env['account.journal'].search([
                    ('type', '=', 'cash'),
                    ('id', 'in', list(journal_ids)),
                ], limit=1)
                if not cash_journal:
                    cash_journal = [statement.journal_id for statement in pos_session.statement_ids if statement.journal_id.type == 'cash']
                    if not cash_journal:
                        raise UserError(_("No cash statement found for this session. Unable to record returned cash."))
                cash_journal_id = cash_journal[0].id
            order.add_payment({
                'amount': -pos_order['amount_return'],
                'payment_date': fields.Datetime.now(),
                'payment_name': _('return'),
                'journal': cash_journal_id,
            })
        return order