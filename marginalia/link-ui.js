/*
 * link-ui.js
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

AN_LINK_CLASS = 'annotation-link';	// class given to a nodes for link annotations
MAX_LINK_LENGTH = 255;


/**
 * Display a link icon for an annotation link
 * Requires that the highlighting for the annotation already be displayed
 * (this is how it figures out just where to put the link icon)
 */
PostMicro.prototype.showLink = function( marginalia, annotation )
{
	// TODO: I don't think this works - should prefix with the AN_LINK_CLASS
	var existingLink = getChildByTagClass( this.contentElement, 'a', AN_ID_PREFIX + annotation.getId(), _skipContent );
	if ( existingLink )
		existingLink.parentNode.removeChild( existingLink );
	
	if ( null != annotation.link && '' != annotation.link )
	{
		var highlights = getChildrenByTagClass( this.contentElement, 'em', AN_ID_PREFIX + annotation.getId(), null, _skipContent );
		for ( var i = 0;  i < highlights.length;  ++i )
		{
			if ( hasClass( highlights[ i ], AN_LASTHIGHLIGHT_CLASS ) )
			{
				// TODO: should check whether a link is valid in this location;  if not,
				// either refuse to show or insert a clickable Javascript object instead
				var lastHighlight = highlights[ i ];
				var supNode = document.createElement( 'sup' );
				var linkNode = document.createElement( 'a' );
				linkNode.setAttribute( 'href', annotation.getLink() );
				
				if ( null != annotation.getNote() && '' != annotation.getNote() )
				{
					var keyword = marginalia.keywordService.getKeyword( annotation.getNote() );
					if ( keyword )
						linkNode.setAttribute( 'title', keyword.name + ': ' + keyword.description );
					else
					{
						linkNode.setAttribute( 'title',
							annotation.getNote().length > MAX_NOTEHOVER_LENGTH
							? annotation.getNote().substr( 0, MAX_NOTEHOVER_LENGTH ) + '...'
							: annotation.getNote() );
					}
				}
				
				linkNode.appendChild( document.createTextNode( AN_LINK_ICON ) );
				supNode.appendChild( linkNode );
				lastHighlight.appendChild( supNode );
				addClass( linkNode, AN_LINK_CLASS + ' ' + AN_ID_PREFIX + annotation.getId() );
			}
		}
	}
}


/**
 * Remove annotation links form a highlighted region
 * This assumes the passed node is a highlight region, and that any elements
 * within it are links and should be removed.
 */ 
function stripLinks( node )
{
	var child = node.firstChild;
	while ( null != child )
	{
		var nextChild = child.nextSibling;
		if ( ELEMENT_NODE == child.nodeType )
			node.removeChild( child );
		child = nextChild;
	}
}


/**
 * Edit an annotation link.  This displays a URL box, and activates the
 * ability to click on block-level elements to link to them.
 */
PostMicro.prototype.editAnnotationLink = function( marginalia, annotation )
{
	annotation.editing = AN_EDIT_LINK;
	var nextNode = this.removeNote( marginalia, annotation );
	var noteElement = this.showNote( marginalia, annotation, nextNode );
	this.repositionNotes( marginalia, noteElement.nextSibling );
	addClass( getBodyElement( document ), AN_EDITINGLINK_CLASS );
	createCookie( AN_LINKING_COOKIE, annotation.id, 1 );
	_enableLinkTargets( );
	if ( window.addEventListener )
		window.addEventListener( 'blur', _disableLinkTargets, false );
}


/**
 * Save an annotation link after editing
 */
PostMicro.prototype.saveAnnotationLink = function( marginalia, annotation )
{
	// Remove events
	removeAnonBubbleEventListener( document.documentElement, 'click', _saveAnnotationLink );
	var noteElement = document.getElementById( AN_ID_PREFIX + annotation.getId() );
	removeAnonBubbleEventListener( noteElement, 'click', stopPropagation );

	// don't allow this to happen more than once
	if ( ! annotation.editing )
		return false;

	// Ensure the window doesn't scroll by saving and restoring scroll position
	var scrollY = getWindowYScroll( );
	var scrollX = getWindowXScroll( );
	
	// TODO: listItem is an alias of noteElement above
	var listItem = document.getElementById( AN_ID_PREFIX + annotation.getId() );	
	var editNode = getChildByTagClass( listItem, 'input', null, null );
	
	// Check the length of the link.  If it's too long, do nothing, but restore focus to the note
	// (which is awkward, but we can't save a note that's too long, we can't allow the note
	// to appear saved, and truncating it automatically strikes me as an even worse solution.) 
	if ( editNode.value.length > MAX_LINK_LENGTH )
	{
		alert( getLocalized( 'link too long' ) );
		editNode.focus( );
		return false;
	}
	
	this.hoverAnnotation( marginalia, annotation, false );
	delete annotation.editing;
	annotationsetLink( editNode.value );
	marginalia.updateAnnotation( annotation, null );

	// Update the link display
	this.showLink( marginalia, annotation );
	
	// Replace the editable note display
	var nextNode = this.removeNote( marginalia, annotation );
	var noteElement = this.showNote( marginalia, annotation, nextNode );
	this.repositionNotes( marginalia, noteElement.nextSibling );
	
	_disableLinkTargets( );
	removeCookie( AN_LINKING_COOKIE );
	removeCookie( AN_LINKURL_COOKIE );
	removeClass( getBodyElement( document ), AN_EDITINGLINK_CLASS );
	window.scrollTo( scrollX, scrollY );
	return true;
}


/**
 * Update the display of an annotation link
 */
PostMicro.prototype.updateLink = function( marginalia, annotation )
{
	// Ensure the window doesn't scroll by saving and restoring scroll position
	var scrollY = getWindowYScroll( );
	var scrollX = getWindowXScroll( );
	
	// Update the link display
	this.showLink( marginalia, annotation );

	// Replace the editable note display
	delete annotation.editing;
	var nextNode = this.removeNote( marginalia, annotation );
	var noteElement = this.showNote( marginalia, annotation, nextNode );
	this.repositionNotes( marginalia, noteElement.nextSibling );
	
	removeClass( getBodyElement( document ), AN_EDITINGLINK_CLASS );
	
	window.scrollTo( scrollX, scrollY );
}


/**
 * Delete a link
 */
PostMicro.prototype.deleteLink = function( marginalia, annotation )
{
	// Ensure the window doesn't scroll by saving and restoring scroll position
	var scrollY = getWindowYScroll( );
	var scrollX = getWindowXScroll( );

	// Delete the link on the server
	annotation.link = '';
	marginalia.updateAnnotation( marginalia, annotation.getId(), null );
	
	this.showLink( marginalia, annotation );
	
	window.scrollTo( scrollX, scrollY );
}



/**
 * Hit a key while editing an annotation link
 */
function _editLinkKeypress( event )
{
	event = getEvent( event );
	var target = getEventTarget( event );
	var post = getNestedFieldValue( target, AN_POST_FIELD );
	var annotation = getNestedFieldValue( target, AN_ANNOTATION_FIELD );
	if ( event.keyCode == 13 )
	{
		//alert('_editLInkKeypress');
		post.saveAnnotationLink( window.marginalia, annotation );
		return false;
	}
	// should check for 27 ESC to cancel edit
	else
	{
		return true;
	}
}


/**
 * Annotation link edit loses focus
 */
function _saveAnnotationLink( event )
{
	// Note that the MS event model doesn't provide info about which element triggered this event
	// so avoid using the event field - look up the currently-edited node instead
	var note = getChildByTagClass( document.documentElement, 'li', AN_EDITINGLINK_CLASS, null );
	// var post = getParentByTagClass( note, null, 'post', false, null );
	var post = getNestedFieldValue( note, AN_POST_FIELD );
	var annotation = getNestedFieldValue( note, AN_ANNOTATION_FIELD );
	post.saveAnnotationLink( window.marginalia, annotation );
}

/**
 * Click button to create an annotation link
 * This sets a cookie indicating a link is being created.  When browser windows
 * are activated, they check for this cookie to allow the user to click on
 * a block element to create a link to it.
 */
function _editLink( event )
{
	event = getEvent( event );
	stopPropagation( event );
	var post = getNestedFieldValue( this, AN_POST_FIELD );
	var annotation = getNestedFieldValue( this, AN_ANNOTATION_FIELD );
	post.editAnnotationLink( window.marginalia, annotation );
}


/**
 * Check whether a link-in-progress is consumated
 */
function _updateLinks( )
{
	if ( hasClass( getBodyElement( document ), AN_EDITINGLINK_CLASS ) )
	{
		var annotationId = readCookie( AN_LINKING_COOKIE );
		var newLink = readCookie( AN_LINKURL_COOKIE );
		if ( annotationId && newLink )
		{
			var annotationNode = document.getElementById( AN_ID_PREFIX + annotationId );
			if ( annotationNode )
			{
				var post = getNestedFieldValue( annotationNode, AN_POST_FIELD );
				var annotation = getNestedFieldValue( annotationNode, AN_ANNOTATION_FIELD );
				var editNode = getChildByTagClass( annotationNode, 'input', null, null );
				editNode.value = newLink;
				post.saveAnnotationLink( window.marginalia, annotation );
			}
		}
	}
}


/**
 * Delete a link
 */
function _deleteLink( event )
{
	event = getEvent( event );
	stopPropagation( event );
	var post = getNestedFieldValue( this, AN_POST_FIELD );
	var annotation = getNestedFieldValue( this, AN_ANNOTATION_FIELD );
	var annotationNode = document.getElementById( AN_ID_PREFIX + annotation.getId() );
	var editNode = getChildByTagClass( annotationNode, 'input', null, null );
	editNode.value = '';
	post.saveAnnotationLink( window.marginalia, annotation );
}


/**
 * Skip embedded links created by Marginalia
 */
function _skipAnnotationLinks( node )
{
	return ELEMENT_NODE == node.nodeType 
		&& node.parentNode
		&& 'a' == getLocalName( node )
		&& hasClass( node.parentNode, AN_HIGHLIGHT_CLASS );
}


