# -*- coding: utf-8 -*-
{
    "name": "Add/Remove tax dynamically in POS order Screen",
    "version": "10.0.1.0",
    "author": "Nilesh Sheliya sami",
    "website": "",
    "category": "Point of Sale",
    "description": """
        By installing this module, user can dynamically add/remove taxes of POS order from POS Screen.
        Module will add two new buttons in the POS Screen 1) Tax Free 2) Apply Tax. Its visible alternatively based on the button press by user.
        If user click on Tax Free button, Apply Tax button visible, Tax Free button invisible. Taxes set on the selected order is removed and also tax is not set if user add new products on that order. 
        If user click on Apply Tax button, Tax Free button visible, Apply Tax button invisible. Taxes applied on the selected order as it is.
    """,
    "depends": ["base","point_of_sale"],
    "live_test_url": "https://odoo.sheliyainfotech.com/contactus?description=demo:pos_tax_free_order&odoo_version=10.0",
    "data": [
             "views/views.xml",
             "views/templates.xml",
            ],
    "qweb": [
           "static/src/xml/pos_template.xml",
            ],
    "images": [],
    'license': 'LGPL-3',
    "installable": True,
    "auto_install": False,
    "application": True,
}
