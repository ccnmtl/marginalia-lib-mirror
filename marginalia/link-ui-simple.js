/*
 * link-ui-simple.js
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
 * This class defines default behavior for elements of the linking user interface
 * An instance is held in th Marginalia object.  Some applications will implement
 * their own versions to provide customized UI behavior.
 */
function SimpleLinkUi( )
{
	return this;
}

/**
 * Called at Marginalia startup
 */
SimpleLinkUi.prototype.init = function( )
{ }

/**
 * May be necessary if this UI is nested in another
 * Use as follows:
 * window.marginalia.linkUI.getSimpleLinkUI( )
 */
SimpleLinkUi.prototype.getSimpleLinkUi = function( )
{
	return this;
}
 
/**
 * ID assigned to note (li) element for annotation being edited
 */
SimpleLinkUi.prototype.getControlId = function( annotation )
{
	return AN_ID_PREFIX + annotation.getId() + '-linkedit';
}

/**
 * Make whatever UI changes are necessary to display link edit controls
 */
SimpleLinkUi.prototype.showLinkEdit = function( marginalia, post, annotation, noteElement )
{
	// Replace note display.  Preserve ID and class values by maintaining note element.
	var noteElement = post.clearNote( marginalia, annotation );
	
	var controlId = this.getControlId( annotation );
	
	// add the link label
	noteElement.appendChild( domutil.element( 'label', {
		title:  getLocalized( 'annotation link label' ),
		attr_for:  controlId,
		content:  AN_LINKEDIT_LABEL } ) );

	// Add the URL input field
	var editNode = noteElement.appendChild( domutil.element( 'input', {
		id:  controlId,
		value:  annotation.getLink() ? annotation.getLink() : '',
		type:  ANNOTATION_EXTERNAL_LINKING ? 'text' : 'hidden' } ) );
	if ( ANNOTATION_EXTERNAL_LINKING )
	{
		addEvent( editNode, 'keypress', this._editLinkKeypress );
		addEvent( editNode, 'keyup', _editChangedKeyup );
	}
	editNode.focus( );
	
	// add the delete button
	noteElement.appendChild( domutil.button( {
		className:  AN_LINKDELETEBUTTON_CLASS,
		title:  getLocalized( 'delete annotation link button' ),
		content:  'x',
		annotationId:  annotation.getId(),
		onclick: this._deleteLink } ) );
		
	// Reposition following notes
	post.repositionNotes( marginalia, noteElement.nextSibling );

	addEvent( document.documentElement, 'click', this.saveLink );
	addEvent( noteElement, 'click', domutil.stopPropagation );
}


/**
 * Link editing is complete:  update the UI accordingly
 * (notes only - highlight UI is updated in a standard way, not customized here - see post.saveAnnotationLink)
 */
SimpleLinkUi.prototype.showLinkEditComplete = function( marginalia, post, annotation )
{
	// Ensure the window doesn't scroll by saving and restoring scroll position
	var scrollY = domutil.getWindowYScroll( );
	var scrollX = domutil.getWindowXScroll( );

	// Redisplay the annotation note
	var noteElement = post.showNote( marginalia, annotation );

	// Remove events
	removeEvent( document.documentElement, 'click', this._anonymousSaveLink );
	removeEvent( noteElement, 'click', domutil.stopPropagation );
	
	post.repositionNotes( marginalia, noteElement.nextSibling );
	
	window.scrollTo( scrollX, scrollY );
}


/**
 * Hit a key while editing an annotation link
 */
SimpleLinkUi.prototype._editLinkKeypress = function( event )
{
	// callback must retrieve object
	var simpleUi = window.marginalia.linkUi.getSimpleLinkUi( );
	var marginalia = window.marginalia;
	var annotation = marginalia.editing;
	var noteElement = annotation.getNoteElement( );
	var post = domutil.nestedFieldValue( noteElement, AN_POST_FIELD );
	
	if ( event.keyCode == 13 )
	{
		simpleUi.saveLink( marginalia, post, annotation, noteElement );
		return false;
	}
	// should check for 27 ESC to cancel edit
	else
	{
		return true;
	}
}


/**
 * Delete a link
 */
SimpleLinkUi.prototype._deleteLink = function( event )
{
	event.stopPropagation( );
	var linkUi = window.marginalia.linkUi;
	var post = domutil.nestedFieldValue( event.target, AN_POST_FIELD );
	var annotation = domutil.nestedFieldValue( event.target, AN_ANNOTATION_FIELD );
	var noteElement = domutil.parentByTagClass( event.target, 'li' );
	var editNode = domutil.childByTagClass( noteElement, 'input', null, null );
	editNode.value = '';
	annotation.setLink( '' );
	linkUi.saveLink( window.marginalia, post, annotation, noteElement );
}

/**
 * Retrieve link text from input field, validate, save, update display
 */
SimpleLinkUi.prototype.saveLink = function( marginalia, post, annotation, noteElement )
{
	// Resolve parameters if this was triggered as a callback
	var simpleUi;
	if ( domutil.instanceOf( this, SimpleLinkUi ) )
		simpleUi = this;
	else
		simpleUi = window.marginalia.linkUi.getSimpleLinkUi( );
	if ( ! domutil.instanceOf( marginalia, Marginalia ) )
	{
		var event = marginalia;
		event.stopPropagation( );
		marginalia = window.marginalia;
		annotation = marginalia.editing;
		noteElement = annotation.getNoteElement( );
		post = domutil.nestedFieldValue( noteElement, AN_POST_FIELD );
	}
		
	// don't allow this to happen more than once
	if ( ! annotation.editing )
		return false;
	delete annotation.editing;

	var editNode = domutil.childByTagClass( noteElement, 'input', null, null );
	
	// Check the length of the link.  If it's too long, do nothing, but restore focus to the note
	// (which is awkward, but we can't save a note that's too long, we can't allow the note
	// to appear saved, and truncating it automatically strikes me as an even worse solution.) 
	if ( editNode.value > MAX_LINK_LENGTH )
	{
		alert( getLocalized( 'link too long' ) );
		editNode.focus( );
		return false;
	}

	annotation.setLink( editNode.value );
	annotation.setLinkTitle( '' );
	post.saveAnnotationLink( marginalia, annotation, noteElement );

	marginalia.linkUi.showLinkEditComplete( marginalia, post, annotation );
}



