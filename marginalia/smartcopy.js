/*
 * smartcopy.js
 *
 * Marginalia has been developed with funding and support from
 * BC Campus, Simon Fraser University, and the Government of
 * Canada, the UNDESA Africa i-Parliaments Action Plan, and  
 * units and individuals within those organizations.  Many 
 * thanks to all of them.  See CREDITS.html for details.
 * Copyright (C) 2005-2007 Geoffrey Glass; the United Nations
 * http://www.geof.net/code/annotation
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
 
// Initialize smartcopy.  Installs the keyhandler to switch the feature on and off.
// Return false if the browser doesn't support the feature.
function smartcopyInit( preferences )
{
	window.smartcopy = new Smartcopy( preferences );
	// No point supporting IE here
	if ( document.addEventListener )
	{
		document.addEventListener ('keyup', _smartcopyKeypressHandler, true );
	}
}

function Smartcopy( preferences )
{
	this.preferences = preferences;
	this.active = false;
}

Smartcopy.prototype.alertSmartcopyStatus = function( )
{
	var msg;
	var smartcopyStatus = document.getElementById( 'smartcopy-status' );

	if ( null == smartcopyStatus )
	{
		// Add box for showing the status of smartcopy
		// Don't do this in init because the page hasn't yet loaded at that point
		smartcopyStatus = document.createElement( 'div' );
		smartcopyStatus.id = 'smartcopy-status';
		
		var bodyElement = document.getElementsByTagName( 'body' )[ 0 ];
		bodyElement.appendChild( smartcopyStatus );
	}
	
	msg = getLocalized( this.active ? 'smartcopy on' : 'smartcopy off' );
	window.status = msg;

	while ( smartcopyStatus.firstChild )
		smartcopyStatus.removeChild( smartcopyStatus.firstChild );
	smartcopyStatus.appendChild( document.createTextNode( msg ) );
	smartcopyStatus.style.display = 'block';
	smartcopyStatus.style.opacity = 1;
	
	var smartcopy = this;
	setTimeout( fadeSmartcopyStatus, 3000 );
}

fadeSmartcopyStatus = function( )
{
	var smartcopyStatus = document.getElementById( 'smartcopy-status' );
	var opacity = smartcopyStatus.style.opacity - .1;
	smartcopyStatus.style.opacity = opacity;
	if ( opacity > 0 )
		setTimeout( fadeSmartcopyStatus, 100 );
	else
		smartcopyStatus.style.display = 'none';
}

function _smartcopyKeypressHandler( event )
{
	var character = String.fromCharCode( event.which );
	if ( ( 's' == character || 'S' == character ) && event.shiftKey && event.ctrlKey )
	{
		var smartcopy = window.smartcopy;
		if ( smartcopy.active )
		{
			smartcopy.smartcopyOff( );
			smartcopy.preferences.setPreference( 'smartcopy', 'false' );
		}
		else
		{
			smartcopy.smartcopyOn( );
			smartcopy.preferences.setPreference( 'smartcopy', 'true' );
		}
		smartcopy.alertSmartcopyStatus();
	}
}

// Switch on smartcopy.  Returns false if the browser doesn't support the feature.
Smartcopy.prototype.smartcopyOn = function( )
{
	if ( document.addEventListener )
	{
		document.addEventListener( 'mouseup', addSmartcopy, false );
		document.addEventListener( 'mousedown', _smartcopyDownHandler, false );
		this.active = true;
		window.status = 'Smartcopy is on.  Press Shift-Ctrl-S to switch it off.';
		return true;
	}
	else
		return false;
}

// Switch off smartcopy
Smartcopy.prototype.smartcopyOff = function( )
{
	if ( document.removeEventListener )
	{
		document.removeEventListener( 'mouseup', addSmartcopy, false );
		document.removeEventListener( 'mousedown', _smartcopyDownHandler, false );
		this.active = false;
		window.status = 'Smartcopy is off.  Press Shift-Ctrl-S to switch it on.';
	}
}

// Smartcopy function called when the mouse button goes down
function _smartcopyDownHandler( )
{
	domutil.stripSubtree( document.documentElement, null, 'smart-copy' );
}

function addSmartcopy( )
{
	var smartcopy = window.smartcopy;
	
	// this won't work with IE
	var selection = window.getSelection();
	var t = selection.type;

	// Verify W3C range support
	if ( selection.rangeCount == null )
		return false;

	// Check that some text has been selected
	if ( selection.rangeCount == 0 )
		return false;
	var range = selection.getRangeAt( 0 );
		
	// Check that the selection is within a post
	var postElement = domutil.parentByTagClass( range.startContainer, null, PM_POST_CLASS, true, PostMicro.skipPostContent );
	if ( null == postElement )
		return false;
	var postInfo = PostPageInfo.getPostPageInfo( document );
	var post = postInfo.getPostMicro( postElement );
	var contentElement = post.getContentElement( );
	
	// Check that both the start and end of the selection are within the post content
	if ( ! domutil.isElementDescendant( range.startContainer, contentElement ) ||
		! domutil.isElementDescendant( range.endContainer, contentElement ) )
		return false;
	
	// Check that there is actually some selected text
	var t = range.toString( );
	if ( 0 == t.length )
		return false;
	
	// OK, now we have a valid selection range to work with.
	var normRange = new NormalizedRange( range, contentElement );
	var oldStart = range.startContainer;
	var oldOffset = range.startOffset;
	var rangeLen = normRange.length;
	// trace( null, "Initial (" + range.startContainer + "," + range.startOffset + ")" );
	
	// Insert the link node
	var span = document.createElement( 'span' );
	span.className = 'smart-copy';
	span.appendChild( document.createTextNode( 'From ') );
	var a = document.createElement( 'a' );
	a.setAttribute( 'href', post.getUrl( ) );
	a.appendChild( document.createTextNode( post.getTitle( ) ) );
	span.appendChild( a );
	if ( null == post.getDate( ) )
		span.appendChild( document.createTextNode( ' by ' + post.getAuthor( ) + ': ') );
	else
		span.appendChild( document.createTextNode( ' by ' + post.getAuthor( ) + ' on ' + post.getDate( ).toLocaleString() + ': ') );
	span.appendChild( document.createElement( 'br' ) );
	range.insertNode( span );
	
	// Find where the end of the range would be now
	var walker = new DOMWalker( span );
	walker.endTag = true;
	// Walk rangeLen characters forward
	var remain = rangeLen;
	while ( walker.walk( true ) )
	{
		if ( TEXT_NODE == walker.node.nodeType )
		{
			if ( remain < walker.node.length )
				break;
			else
				remain -= walker.node.length;
		}
	}
	
	if ( selection.removeAllRanges && selection.addRange )
	{
		selection.removeAllRanges( );
		range.setStart( oldStart, oldOffset );
		range.setEnd( walker.node, remain );
		selection.addRange( range );
	}
	else
	{
		range.setStart( oldStart, oldOffset );
		range.setEnd( walker.node, remain );
	}
}

/*
 * Passed to range functions so they will ignore smartcopy nodes
 */
function _skipSmartcopy( node )
{
	if ( ELEMENT_NODE == node.nodeType )
		return domutil.hasClass( node, 'smart-copy' ) ? true : false;
	return false;
}
