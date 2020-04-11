from odoo import http


class PasswordController(http.Controller):

    @http.route('/set/password', auth='public')
    def index(self):
        return 'Hello'