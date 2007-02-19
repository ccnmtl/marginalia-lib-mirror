/* 
 * log.js
 *
 * Logging code
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
 */

// Only works on Mozilla - other browsers have no dump function
function logError( s )
{
	if ( LOGGING_ON )
	{
		if ( window.dump )
		{
			// Not working - dunno why.  Or why it has to be so obtuse.
			/*
			netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
			var logger = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
			logger.logStringMessage( s  );
			*/
			dump( "ERROR: " + s + "\n" );
		}
		var dumpElement = document.getElementById( 'debug' );
		if ( INWINDOW_LOG && dumpElement )
		{
			dumpElement.style.display = 'block';
			var li = document.createElement( 'li' );
			li.appendChild( document.createTextNode( s ) );
			dumpElement.appendChild( li );
		}
	}
}

function setTrace( topic, b )
{
	if ( null == window.traceSettings )
		window.traceSettings = new Object( );
	window.traceSettings[ topic ] = b;
}

function trace( topic, s )
{
	if ( TRACING_ON && !topic || ( null != window.traceSettings && window.traceSettings[ topic ]) )
	{
		if ( window.dump )
			dump( s + "\n");
		var dumpElement = document.getElementById( 'debug' );
		if ( INWINDOW_LOG && dumpElement )
		{
			dumpElement.style.display = 'block';
			var li = document.createElement( 'li' );
			li.appendChild( document.createTextNode( s ) );
			dumpElement.appendChild( li );
		}
	}
}
