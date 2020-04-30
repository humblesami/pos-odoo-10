# -*- coding: utf-8 -*-
{
    'name': "Customer Restriction",

    'summary': """
        Sale User restricted to own customers only
        """,


    'author': "Visiomate sami",

    'version': '0.1',

    # any module necessary for this one to work correctly
    'depends': ['sale', 'sales_team'],
    'data': [
        'security/customer_security.xml'
    ],
}