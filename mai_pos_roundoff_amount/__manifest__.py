
{
    'name': 'POS Rounding (Auto UP and DOWN Rounding)',
    'version': '10.0.2',
    'summary': 'POS Rounding Amount',
    'price': 8.00,
    'currency': 'EUR',
    "author" : "MAISOLUTIONSLLC sami",
    "email": 'apps@maisolutionsllc.com',
    "website":'http://maisolutionsllc.com/',
    'description': "Using this module you can set auto up and down rounding Digits and Points based. Here there is a button for enable Rounding using this u can enable Rounding. And here Once you enable rounding AUTO UP and DOWN rounding will be apply.",
    'license': 'OPL-1', 
    'category': 'Point Of Sale',
    'depends': ['base', 'point_of_sale'],
    'data': [
        'views/point_of_sale.xml',
        'views/mai_pos_roundoff_amount.xml'
    ],
    'images': ['static/description/main_screenshot.png'],
    "live_test_url" : "https://youtu.be/UcGYXVv_P4M ",       
    'qweb': ['static/src/xml/pos.xml'],
    'installable': True,
    'application': True,
}
