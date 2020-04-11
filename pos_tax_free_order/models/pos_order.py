# -*- coding: utf-8 -*-
from odoo import models, fields


class pos_order(models.Model):
    _inherit = 'pos.order'

    is_tax_free_order = fields.Boolean("Is Tax free order?", default=False)


class resUserInherit(models.Model):
    _inherit = 'res.users'

    def checkIfPinExist(self, password):
        if password:
            results = self.env['res.users'].search([
                ('is_allow_taxfree', '=', True),
                ('pos_security_pin', '=', password),
            ], limit=1)

            if results:
                return "matched"
            else:
                return "not matched"

    is_allow_taxfree = fields.Boolean("Is Allowed Tax Free", help="Is Allowed Tax Free by Providing PIN")