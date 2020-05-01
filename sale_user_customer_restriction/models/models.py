from odoo import models, api


class ResPartner(models.Model):
    _inherit = 'res.partner'

    @api.model
    def _where_calc(self, domain, active_test=True):
        user = self.env.user
        if not user.has_group('sales_team.group_sale_manager') and (
                user.has_group('sales_team.group_sale_salesman') or user.has_group('group_sale_salesman_all_leads')):
            domain.append(('create_uid', '=', self._uid))
        res = super(ResPartner, self)._where_calc(domain, active_test)
        return res

