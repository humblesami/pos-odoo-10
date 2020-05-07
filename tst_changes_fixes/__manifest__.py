# -*- coding: utf-8 -*-
{
    'name': "tst_changes_fixes",

    'summary': """
        """,
    'author': "Visiomate sami",

    # any module necessary for this one to work correctly
    'depends': ['tst_changes'],

    # always loaded
    'data': [
        'views/pos_template.xml',
        'views/car_readings.xml',
        'views/menu.xml',
    ],
    'qweb': ['static/src/xml/tst_car_changes.xml'],
}