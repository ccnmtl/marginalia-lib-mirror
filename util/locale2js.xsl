<?xml version="1.0"?>

<!--
 Template for converting Marginalia strings to Javascript.
 This should be run on the XML file in the locale directory to produce
 strings.js.  More sophisticated implementations (e.g. the Marginalia 
 plugin for OJS) figure out which locale to provide on the server side.
-->

<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
	
<xsl:output method="text"/>

<xsl:param name="output"/>

<xsl:template match="/">
<xsl:text>
/*
 * Languages for annotation Javascript
 */

/*
 * Fetch a localized string
 * This is a function so that it can be replaced with another source of strings if desired
 * (e.g. in a database).  The application uses short English-language strings as keys, so
 * that if the language source is lacking the key can be returned instead.
 */
function getLocalized( s )
{
	return LocalizedAnnotationStrings[ s ];
}

LocalizedAnnotationStrings = {
</xsl:text>
	<xsl:apply-templates/>
	'lang' : 'en'
};
</xsl:template>

<xsl:template match="message"
	><xsl:if test="not( @output ) or contains( @output, $output )"
	>'<xsl:value-of select="@key"/>' : '<xsl:value-of select="."/>',
	</xsl:if
></xsl:template>

</xsl:stylesheet>

