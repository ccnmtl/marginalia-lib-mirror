/*
 * log-service.js
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

function LogService( serviceUrl, user )
{
	this.serviceUrl = serviceUrl;
	this.user = user;
	return this;
}

/**
 * Create an annotation on the server
 * When successful, calls a function f with one parameter:  the URL of the created annotation
 */
LogService.prototype.record = function( topic, severity, message )
{
	var serviceUrl = this.serviceUrl;
		
	var body
		= "url=" + encodeURIParameter( window.location )
		+ "&topic=" + encodeURIParameter( topic )
		+ "&severity=" + encodeURIParameter( severity )
		+ "&message=" + encodeURIParameter( message );
	var xmlhttp = createAjaxRequest( );
	
	xmlhttp.open( 'POST', serviceUrl, true );
	xmlhttp.setRequestHeader( 'Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8' );
	xmlhttp.setRequestHeader( 'Content-length', body.length );
	// No point checking whether it succeeded - where would that be reported to?
	xmlhttp.send( body );
}

