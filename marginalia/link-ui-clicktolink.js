/*
 * link-ui-linkable.js
 *
 * Click-to-link support (used in OJS)
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
 

/**
 * Don't initialize this until the DOM has been loaded
 */
function ClickToLinkUi( extlinks )
{
	 this.simpleUi = new SimpleLinkUi( extlinks );

	 // Click-to-link doesn't work in IE because of its weak event model
	if ( window.addEventListener )
	{
		window.addEventListener( 'focus', _enableLinkTargets, false );
		window.addEventListener( 'focus', _updateLinks, false );
	}
}

ClickToLinkUi.prototype.getSimpleLinkUi = function( )
{
	return this.simpleUi;
}


ClickToLinkUi.prototype.showLinkEdit = function( marginalia, post, annotation, noteElement )
{
	// Show the simple link input controls
	this.simpleUi.showLinkEdit( marginalia, post, annotation, noteElement );
	
	// Tell this window and others to be accept clicks for link creation
	domutil.addClass( document.body, AN_EDITINGLINK_CLASS );
	createCookie( AN_LINKING_COOKIE, annotation.id, 1 );
	_enableLinkTargets( );
	if ( window.addEventListener )
		window.addEventListener( 'blur', _disableLinkTargets, false );
}

ClickToLinkUi.prototype.showLinkEditComplete = function( marginalia, post, annotation, noteElement )
{
	_disableLinkTargets( );
	removeCookie( AN_LINKING_COOKIE );
	removeCookie( AN_LINKURL_COOKIE );
	domutil.removeClass( document.body, AN_EDITINGLINK_CLASS );
	
	this.simpleUi.showLinkEditComplete( marginalia, post, annotation, noteElement );
}

ClickToLinkUi.prototype.saveLink = function( marginalia, post, annotation, noteElement )
{
	if ( ! marginalia.editing )
		return false;
	this.simpleUi.saveLink( marginalia, post, annotation, noteElement );
}

/**
 * Check whether a link-in-progress is consumated
 * Callback set up (in this browser window and others) by
 * _enableLinkTargets, removed by _disableLinkTargets
 */
function _updateLinks( )
{
	if ( domutil.hasClass( document.body, AN_EDITINGLINK_CLASS ) )
	{
		var annotationId = readCookie( AN_LINKING_COOKIE );
		var newLink = readCookie( AN_LINKURL_COOKIE );
		if ( annotationId && newLink )
		{
			var annotationNode = document.getElementById( AN_ID_PREFIX + annotationId );
			if ( annotationNode )
			{
				var marginalia = window.marginalia;
				var post = domutil.nestedFieldValue( annotationNode, AN_POST_FIELD );
				var annotation = domutil.nestedFieldValue( annotationNode, AN_ANNOTATION_FIELD );
				var editNode = domutil.childByTagClass( annotationNode, 'input', null, null );
				editNode.value = newLink;
				marginalia.linkUi.saveLink( marginalia, post, annotation, annotation.getNoteElement( ) );
			}
		}
	}
}

