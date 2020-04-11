from openerp import models, fields, api, _


class account_journal(models.Model):
    _inherit = "account.journal"

    @api.model
    def name_search(self, name, args=None, operator='ilike', limit=100):
        if self._context.get('pos_journal'):
            if self._context.get('journal_ids') and self._context.get('journal_ids')[0][2]:
                args = [[u'id', u'in', self._context.get('journal_ids')[0][2]]]
                return super(account_journal, self).name_search(name, args=args, operator=operator, limit=limit)
            return False
        else:
            return super(account_journal, self).name_search(name, args=args, operator=operator, limit=limit)

