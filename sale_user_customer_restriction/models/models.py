from odoo import models


class ResPartner(models.Model):
    _inherit = 'res.partner'

    def search(self, args, offset=0, limit=None, order=None, count=False):
        user = self.env.user
        if user.has_group('sales_team.group_sale_salesman') or user.has_group('group_sale_salesman_all_leads'):
            args.append(('create_uid', '=', self._uid))
        res = super(ResPartner, self).search(args, offset=0, limit=None, order=None, count=False)
        return res