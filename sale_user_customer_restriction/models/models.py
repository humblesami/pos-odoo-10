from odoo import models, api


class ResPartner(models.Model):
    _inherit = 'res.partner'

    @api.model
    def search(self, args, offset=0, limit=None, order=None, count=False):
        user = self.env.user
        if not user.has_group('sales_team.group_sale_manager') and (
                user.has_group('sales_team.group_sale_salesman') or user.has_group('group_sale_salesman_all_leads')):
            args.append(('create_uid', '=', self._uid))
        res = super(ResPartner, self).search(args, offset, limit, order, count=count)
        return res

    @api.model
    def name_search(self, name='', args=None, operator='ilike', limit=100):
        user = self.env.user
        if not user.has_group('sales_team.group_sale_manager') and (
            user.has_group('sales_team.group_sale_salesman') or user.has_group('group_sale_salesman_all_leads')):
            args.append(('create_uid', '=', self._uid))
        res = super(ResPartner, self).name_search(name=name, args=args, operator=operator, limit=limit)
        return res
