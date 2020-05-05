import lxml.html
html_str = """
	<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
	<html xmlns="http://www.w3.org/1999/xhtml">
	    <head><title> </title></head>
	    <body>
	        <form name="form1" method="post" action="./web-to-sms.aspx?username=totalsoft%40bizsms.pk&amp;pass=t1ot3lsfty*9*&amp;text=You+order+%23+Main%2f0234+is+processed&amp;masking=Total+Soft&amp;destinationnum=923354646028&amp;language=English" id="form1">
	            <input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="/wEPDwUJOTczNTMyNjI5D2QWAgIDD2QWAgIBDw8WAh4EVGV4dAUWU01TIFNlbnQgU3VjY2Vzc2Z1bGx5LmRkZOstb06W65SMit2Wh6CliEuPWsJopBmvNmrkOhJxUusy" />
	            <input type="hidden" name="__VIEWSTATEGENERATOR" id="__VIEWSTATEGENERATOR" value="7420F5AE" />
	            <div>
	                <b>
	                    <span id="lblmessage">SMS Sent Successfully.</span>
	                </b>
	            </div>
	        </form>
	    </body>
	</html>
"""
def get_text_from_html(html_str):
    html = lxml.html.fromstring(html_str)
    contents = html.text_content().strip()
    return contents