# -*- coding: utf-8 -*-
# © 2017 TKO <http://tko.tko-br.com>
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).

{
    'name': 'TST Modifications',
    'summary': '',
    'description': 'Modifications required for Total Soft',
    'author': 'Cybill Technologies sami',
    'category': 'Discuss',
    'license': 'AGPL-3',
    'website': 'http://www.cybilltechsolutions.com/',
    'version': '10.0.0.0.0',
    'application': True,
    'depends': ['web', 'base','mail','point_of_sale','hr','pos_restaurant','report'],
    'data': [
        'views/tst_template.xml',
        'views/tst_changes.xml',
        'views/views.xml',
        'views/cars.xml',
        'views/report_sales.xml',
        'views/sequence.xml',
        'report/custom_report.xml',
        'report/report_format.xml',
        'security/security.xml',
        'security/ir.model.access.csv',
        ],
    'qweb': ['static/src/xml/tst_car_changes.xml','static/src/xml/restaurant_template.xml'],
    'installable': True,
    'auto_install': False,
}
