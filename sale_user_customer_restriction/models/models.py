from odoo import models


class ResPartner(models.Model):
    _inherit = 'res.partner'

    def search(self, args, offset=0, limit=None, order=None, count=False):
        user = self.env.user
        if user.has_group('sales_team.group_sale_salesman') or user.has_group('group_sale_salesman_all_leads'):
            args.append(('create_uid', '=', self._uid))
        res = super(ResPartner, self).search(args, offset, limit, order, count)
        return res

    def _name_search(self, name='', args=None, operator='ilike', limit=100, name_get_uid=None):
        user = self.env.user
        if user.has_group('sales_team.group_sale_salesman') or user.has_group('group_sale_salesman_all_leads'):
            args.append(('create_uid', '=', self._uid))
        res = super(ResPartner, self)._name_search(name, args, operator, name_get_uid)
        return res