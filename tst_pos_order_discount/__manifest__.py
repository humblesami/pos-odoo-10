# -*- coding: utf-8 -*-
#################################################################################
# Author      : Webkul Software Pvt. Ltd. (<https://webkul.com/>)
# Copyright(c): 2015-Present Webkul Software Pvt. Ltd.
# All Rights Reserved.
#
#
#
# This program is copyright property of the author mentioned above.
# You can`t redistribute it and/or modify it.
#
#
# You should have received a copy of the License along with this program.
# If not, see <https://store.webkul.com/license.html/>
#################################################################################
{
  "name"                 :  "TotalSoft POS Order Discount",
  "summary"              :  "By default in Odoo Point of Sale, a discount is applied individually on every product instead of the total amount. Using this module seller can apply the discount on the total amount of the Sale Order.",
  "category"             :  "Point of Sale",
  "version"              :  "1.2",
  "sequence"             :  1,
  "author"               :  "Ahmed Khakwani",
  "license"              :  "Other proprietary",
  "website"              :  "",
  "description"          :  """Odoo POS Order Discount
POS Order line discount
POS Orderline discount
Discount per product
POS Per product off
Odoo POS discount
Order discount
Fixed order line discount POS
Percentage discount odoo POS
Customer discount POS
Purchase discount 
Sales order discount
""",
  "depends"              :  ['point_of_sale','pos_tax_free_order','tst_changes'],
  "data"                 :  [
                             'security/ir.model.access.csv',
                             'views/templates.xml',
                             'views/pos_discount_view.xml',
                            ],
  "qweb"                 :  [
                             'static/src/xml/discount.xml',
                             'static/src/xml/pos_discount.xml',
                            ],
  "application"          :  True,
  "installable"          :  True,
  "auto_install"         :  False,
}