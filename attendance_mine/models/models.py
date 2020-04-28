# -*- coding: utf-8 -*-

from odoo import models, fields, api
from odoo.exceptions import ValidationError


class HrAttendance(models.Model):
    _inherit = 'hr.attendance'

    @api.model
    def create(self, vals):
        me_emp = self.env['hr.employee'].search([('user_id', '=', self.env.uid)], limit=1)
        if not me_emp:
            raise ValidationError('You must be an employee to mark attendance')
        my_id = me_emp[0].id
        if vals.get('employee_id') != my_id:
            if not self.env.user.has_group('hr_attendance.group_hr_attendance_user'):
                raise ValidationError('You can mark only your own attendance')
        res = super(HrAttendance, self).create(vals)
        return res
