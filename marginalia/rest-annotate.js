/*
 * rest-annotate.js
 * REST implementation of the connection to the annotation back-end
 *
 * Marginalia has been developed with funding and support from
 * BC Campus, Simon Fraser University, and the Government of
 * Canada, and units and individuals within those organizations.
 * Many thanks to all of them.  See CREDITS.html for details.
 * Copyright (C) 2005-2007 Geoffrey Glass www.geof.net
 * 
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 *
 * $Id$
 */

// If this is true, uses paths like annotate/nnn
// if false, use paths like annotation/annotate.php?id=nnn
ANNOTATION_NICE_URLS = false;


/**
 * I'm tired of the standard Javascript encodeURIComponent encoding slashes
 * and colons in query parameters.  This makes debugging information difficult
 * to read, and there's really no point to it (at least for URI parameters).  
 * This function uses encodeURIComponent, then converts back some translations 
 * to make everything easier to read and debug.
 */
function encodeURIParameter( s )
{
	s = encodeURIComponent( s );
	s = s.replace( /%2[fF]/g, '/' );
	s = s.replace( /%3[aA]/g, ':' );
	s = s.replace( /%20/g, '+' );
	s = s.replace( /%5[bB]/g, '[' );
	s = s.replace( /%5[dD]/g, ']' );
	s = s.replace( /%2[cC]/g, ',' );
	s = s.replace( /%3[bB]/g, ';' );
	return s;
}


/**
 * Initialize the REST annotation service
 */
function RestAnnotationService( serviceUrl )
{
	if ( ANNOTATION_NICE_URLS )
		this.serviceUrl = serviceUrl + NICE_ANNOTATION_SERVICE_URL;
	else
		this.serviceUrl = serviceUrl + UGLY_ANNOTATION_SERVICE_URL;
	return this;
}

/**
 * Fetch a list of annotations from the server
 */
RestAnnotationService.prototype.listAnnotations = function( url, username, point, f )
{
	// exclude content to lighten the size across the wire
	var serviceUrl = this.serviceUrl;
	serviceUrl += '?format=atom';
	if ( point )
		serviceUrl += '&point=' + encodeURIParameter( point );
	serviceUrl += '&user=' + encodeURIParameter( username ) + '&url=' + encodeURIParameter( url );
	
	var xmlhttp = createAjaxRequest( );
	xmlhttp.open( 'GET', serviceUrl );
	//xmlhttp.setRequestHeader( 'Accept', 'application/xml' );
	xmlhttp.onreadystatechange = function( ) {
		if ( xmlhttp.readyState == 4 ) {
			if ( xmlhttp.status == 200 ) {
				if ( null != f )
				{
					trace( 'list-annotations-xml', "listAnnotations result:\n" + xmlhttp.responseText );
					// alert( serviceUrl + "\n" + xmlhttp.responseText );
					f( xmlhttp.responseXML );
				}
			}
			else {
				trace( "ListAnnotations Server request failed with code " + xmlhttp.status + ":\n" + serviceUrl );
			}
			xmlhttp = null;
		}
	}
	trace( 'annotation-service', "AnnotationService.listAnnotations " + serviceUrl)
	xmlhttp.send( null );
}

/**
 * Create an annotation on the server
 * When successful, calls a function f with one parameter:  the URL of the created annotation
 */
RestAnnotationService.prototype.createAnnotation = function( annotation, f )
{
	var serviceUrl = this.serviceUrl;
		
	var body
		= 'url=' + encodeURIParameter( annotation.getUrl() )
		+ '&note=' + encodeURIParameter( annotation.getNote() )
		+ '&access=' + encodeURIParameter( annotation.getAccess() )
		+ '&quote=' + encodeURIParameter( annotation.getQuote() )
		+ '&quote_title=' + encodeURIParameter( annotation.getQuoteTitle() )
		+ '&quote_author=' + encodeURIParameter( annotation.getQuoteAuthor() )
		+ '&link=' + encodeURIParameter( annotation.getLink() );
	if ( annotation.getAction() )
		body += '&action=' + encodeURIParameter (annotation.getAction() );
	if ( annotation.getRange( BLOCK_RANGE ) )
		body += '&block-range=' + encodeURIParameter( annotation.getRange( BLOCK_RANGE ).toString( ) );
	if ( annotation.getRange( XPATH_RANGE ) )
		body += '&xpath-range=' + encodeURIParameter( annotation.getRange( XPATH_RANGE ).toString( ) );
	var xmlhttp = createAjaxRequest( );
	
	xmlhttp.open( 'POST', serviceUrl, true );
	xmlhttp.setRequestHeader( 'Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8' );
	//xmlhttp.setRequestHeader( 'Accept', 'application/xml' );
	xmlhttp.setRequestHeader( 'Content-length', body.length );
	xmlhttp.onreadystatechange = function( ) {
		if ( xmlhttp.readyState == 4 ) {
			// No need for Safari hack, since Safari can't create annotations anyway.
			if ( xmlhttp.status == 201 ) {
				var url = xmlhttp.getResponseHeader( 'Location' );
				if ( null != f )
				{
					trace( 'annotation-service', 'Create annotation body: ' + xmlhttp.responseText );
					f( url );
				}
			}
			else {
				logError( "AnnotationService.createAnnotation failed with code " + xmlhttp.status + ":\n" + serviceUrl + "\n" + xmlhttp.responseText );
			}
			xmlhttp = null;
		}
	}
	trace( 'annotation-service', "AnnotationService.createAnnotation " + serviceUrl + "\n" + body );
	xmlhttp.send( body );
}

/**
 * Update an annotation on the server
 * Only updates the fields that have changed
 */
RestAnnotationService.prototype.updateAnnotation = function( annotation, f )
{
	var serviceUrl = this.serviceUrl;
	serviceUrl += ANNOTATION_NICE_URLS ? ( '/' + annotation.getId() ) : ( '?id=' + annotation.getId() );
	
	var body = '';
	if ( annotation.hasChanged( 'note' )  )
		body = 'note=' + encodeURIParameter( annotation.getNote() );
	if ( annotation.hasChanged( 'access' ) )
		body += ( body == '' ? '' : '&' ) + 'access=' + encodeURIParameter( annotation.getAccess() );
	if ( annotation.hasChanged( 'link' ) )
		body += ( body == '' ? '' : '&' ) + 'link=' + encodeURIParameter( annotation.getLink() );
	if ( annotation.hasChanged( 'range/' + BLOCK_RANGE ) )
		body += '&block-range=' + encodeURIParameter( annotation.getRange( BLOCK_RANGE ).toString( ) );
	if ( annotation.hasChanged( 'range/' + XPATH_RANGE ) )
		body += '&xpath-range=' + encodeURIParameter( annotation.getRange( XPATH_RANGE ).toString( ) );

	var xmlhttp = createAjaxRequest( );
	xmlhttp.open( 'PUT', serviceUrl, true );
	xmlhttp.setRequestHeader( 'Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8' );
	//xmlhttp.setRequestHeader( 'Accept', 'application/xml' );
	xmlhttp.setRequestHeader( 'Content-length', body.length );
	xmlhttp.onreadystatechange = function( ) {
		if ( xmlhttp.readyState == 4 ) {
			// Safari is braindead here:  any status code other than 200 is converted to undefined
			// IE invents its own 1223 status code
			// See http://www.trachtenberg.com/blog/?p=74
			if ( 204 == xmlhttp.status || xmlhttp.status == null || xmlhttp.status == 1223 ) {
				if ( null != f )
					f( xmlhttp.responseXML );
			}
			else
				logError( "AnnotationService.updateAnnotation failed with code " + xmlhttp.status + " (" + xmlhttp.statusText + ")\n" + xmlhttp.statusText + "\n" + xmlhttp.responseText );
			xmlhttp = null;
		}
	}
	trace( 'annotation-service', "AnnotationService.updateAnnotation " + serviceUrl );
	trace( 'annotation-service', "  " + body );
	xmlhttp.send( body );
}

/**
 * Delete an annotation on the server
 */
RestAnnotationService.prototype.deleteAnnotation = function( annotationId, f )
{
	var serviceUrl = this.serviceUrl;
	serviceUrl += ANNOTATION_NICE_URLS ? ( '/' + annotationId ) : ( '?id=' + annotationId );
	
	var xmlhttp = createAjaxRequest( );
	xmlhttp.open( 'DELETE', serviceUrl, true );
	//xmlhttp.setRequestHeader( 'Accept', 'application/xml' );
	xmlhttp.onreadystatechange = function( ) {
		if ( xmlhttp.readyState == 4 ) {
			// Safari is braindead here:  any status code other than 200 is converted to undefined
			// IE invents its own 1223 status code
			if ( 204 == xmlhttp.status || xmlhttp.status == null || xmlhttp.status == 1223 ) {
				if ( null != f )
					f( xmlhttp.responseXML );
			}
			else
				logError( "AnnotationService.deleteAnnotation failed with code " + xmlhttp.status + "\n" + xmlhttp.responseText );
			xmlhttp = null;
		}
	}
	trace( 'annotation-service', "AnnotationService.deleteAnnotation " + serviceUrl );
	xmlhttp.send( null );
}

