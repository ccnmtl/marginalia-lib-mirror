/*
 * note-ui.js
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

AN_NOTES_CLASS = 'notes';			// the notes portion of a fragment
AN_DUMMY_CLASS = 'dummy';			// used for dummy item in note list 
AN_QUOTENOTFOUND_CLASS = 'quote-error';	// note's corresponding highlight region not found
AN_NOTECOLLAPSED_CLASS = 'collapsed';		// only the first line of the note shows
AN_EDITCHANGED_CLASS = 'changed';	// indicates content of a text edit changed

MAX_NOTE_LENGTH = 250;
MAX_NOTEHOVER_LENGTH = 24;

// Classes to identify specific controls
AN_LINKBUTTON_CLASS = 'annotation-link';
AN_ACCESSBUTTON_CLASS = 'annotation-access';
AN_DELETEBUTTON_CLASS = 'annotation-delete';
AN_EXPANDBUTTON_CLASS = 'expand-edit';
AN_KEYWORDSCONTROL_CLASS = 'keywords';

AN_SUN_SYMBOL = '\u25cb'; //'\u263c';
AN_MOON_SYMBOL = '\u25c6'; //'\u2641';
AN_LINK_ICON = '\u263c'; //'\u238b'; circle-arrow // \u2318 (point of interest) \u2020 (dagger) \u203b (reference mark) \u238b (circle arrow)
AN_LINK_EDIT_ICON = '\u263c'; //'\u238b'; circle-arrow// \u2021 (double dagger)
AN_COLLAPSED_ICON = '+'; // '\u25b7'; triangle
AN_EXPANDED_ICON = '-'; // '\u25bd';
AN_LINKEDIT_LABEL = '\u263c'; // '\u238b'; circle-arrow


/**
 * Get the list of notes.  It is a DOM element containing children,
 * each of which has an annotation field referencing an annotation.
 * There is a dummy first child because of spacing problems in IE.
 */
PostMicro.prototype.getNotesElement = function( marginalia )
{
	// Make sure it has the additional annotation properties added
	if ( ! this.notesElement )
	{
		var t = getChildByTagClass( this.element, null, AN_NOTES_CLASS, _skipPostContent );
		this.notesElement = t.getElementsByTagName( 'ol' )[ 0 ];
	}
	return this.notesElement;
}


 /**
 * Get the node that will follow this one once it is inserted in the node list
 * Slow, but necessary when the annotation has not yet been inserted in the node list
 * A return value of null indicates the annotation would be at the end of the list
 */
PostMicro.prototype.getAnnotationNextNote = function( marginalia, annotation )
{
	var notesElement = this.getNotesElement( marginalia );
	// Go from last to first, on the assumption that this function will be called repeatedly
	// in order.  Calling in reverse order gives worst-case scenario O(n^2) behavior.
	for ( var prevNode = notesElement.lastChild;  null != prevNode;  prevNode = prevNode.previousSibling )
	{
		// In case it's a dummy list item or other
		if ( ELEMENT_NODE == prevNode.nodeType && prevNode.annotation )
		{
			// Why on earth would this happen??
			if ( prevNode.annotation.getId() == annotation.getId() )
				break;
			else if ( annotation.compareRange( prevNode.annotation ) >= 0 )
				break;
		}
	}
	
	if ( prevNode )
		return prevNode.nextSibling;
	else
	{
		// Insert at the beginning of the list - but after any initial dummy nodes!
		var nextNode;
		for ( nextNode = notesElement.firstChild;  nextNode;  nextNode = nextNode.nextSibling )
		{
			if ( ELEMENT_NODE == nextNode.nodeType && nextNode.annotation )
				break;
		}
		return nextNode;	// will be null if no annotations in the list
	}
}


/**
 * Create an item in the notes list
 * pos - the position in the list
 * annotation - the annotation
 */
PostMicro.prototype.showNote = function( marginalia, annotation, nextNode )
{
	var noteList = this.getNotesElement( marginalia );

	// Will need to align the note with the highlight.
	// If the highlight is not found, then the quote doesn't match - display
	// the annotation, but with an error and deactivate some behaviors.
	var highlightElement = getChildByTagClass( this.contentElement, 'em', AN_ID_PREFIX + annotation.getId(), null );
	var quoteFound = highlightElement != null;
	
	// Create the list item
	var postMicro = this;
	var noteElement = document.createElement( 'li' );
	noteElement.id = AN_ID_PREFIX + annotation.getId();
	noteElement.annotationId = annotation.getId();
	noteElement.annotation = annotation;
	if ( ! quoteFound )
		addClass( noteElement, AN_QUOTENOTFOUND_CLASS );
	
	// Create its contents
	if ( AN_EDIT_NOTE_KEYWORDS == annotation.editing || AN_EDIT_NOTE_FREEFORM == annotation.editing )
	{
		addClass( noteElement, AN_EDITINGNOTE_CLASS );

		if ( ANNOTATION_KEYWORDS )
		{
			var expandButton = document.createElement( 'button' );
			expandButton.className = AN_EXPANDBUTTON_CLASS;
			expandButton.setAttribute( 'title', 'annotation expand edit button' );
			expandButton.appendChild( document.createTextNode(
				AN_EDIT_NOTE_KEYWORDS == annotation.editing ? AN_COLLAPSED_ICON : AN_EXPANDED_ICON ) );
			expandButton.onclick = _expandEdit;
			noteElement.appendChild( expandButton );

			this.showNoteEdit( marginalia, noteElement );
		}
		
		// If anywhere outside the note area is clicked, the annotation will be saved.
		// Beware serious flaws in IE's model (see addAnonBubbleEventListener code for details),
		// so this only works because I can figure out which element was clicked by looking for
		// AN_EDITINGNOTE_CLASS.
		addAnonBubbleEventListener( document.documentElement, 'click', _saveAnnotation );
		addAnonBubbleEventListener( noteElement, 'click', stopPropagation );
	}
	else if ( AN_EDIT_LINK == annotation.editing )
	{
		addClass( noteElement, AN_EDITINGLINK_CLASS );
		
		var controlId = AN_ID_PREFIX + annotation.getId() + '-linkedit';
		
		// add the link label
		var labelNode = document.createElement( 'label' );
		labelNode.setAttribute( 'title', getLocalized( 'annotation link label' ) );
		labelNode.appendChild( document.createTextNode( AN_LINKEDIT_LABEL ) );
		labelNode.setAttribute( 'for', controlId );
		noteElement.appendChild( labelNode );

		// Add the URL input field
		var editNode = document.createElement( 'input' );
		editNode.setAttribute( 'id', controlId );
		editNode.setAttribute( 'value', annotation.getLink() ? annotation.getLink() : '' );
		if ( ANNOTATION_EXTERNAL_LINKING )
		{
			editNode.setAttribute( 'type', 'text' );
			editNode.onkeypress = _editLinkKeypress;
			editNode.onkeyup = _editChangedKeyup;
		}
		else
			editNode.setAttribute( 'type', 'hidden' );
		noteElement.appendChild( editNode );
		
		// add the delete button
		var buttonNode = document.createElement( "button" );
		buttonNode.setAttribute( 'type', "button" );
		buttonNode.className = AN_DELETEBUTTON_CLASS;
		buttonNode.setAttribute( 'title', getLocalized( 'delete annotation link button' ) );
		buttonNode.appendChild( document.createTextNode( "x" ) );
		buttonNode.annotationId = annotation.getId();
		buttonNode.onclick = _deleteLink;
		noteElement.appendChild( buttonNode );

		// If anywhere outside the note area is clicked, the annotation will be saved.
		// Beware serious flaws in IE's model (see addAnonBubbleEventListener code for details),
		// so this only works because I can figure out which element was clicked by looking for
		// AN_EDITINGNOTE_CLASS.
		addAnonBubbleEventListener( document.documentElement, 'click', _saveAnnotationLink );
		addAnonBubbleEventListener( noteElement, 'click', stopPropagation );
	}
	else
	{
		// Does this user have permission to edit this annotation?
		var canEdit = null != marginalia.username && annotation.getUserId() == marginalia.username;
		if ( canEdit )
		{
			var controls = document.createElement( 'div' );
			controls.className = 'controls';
			noteElement.appendChild( controls );
			
			if ( ANNOTATION_LINKING )
			{
				// add the link button
				var buttonNode = document.createElement( 'button' );
				buttonNode.setAttribute( 'type', 'button' );
				buttonNode.className = AN_LINKBUTTON_CLASS;
				buttonNode.setAttribute( 'title', getLocalized( 'annotation link button' ) );
				buttonNode.appendChild( document.createTextNode( AN_LINK_EDIT_ICON ) );
				buttonNode.setAttribute( 'href', annotation.getLink() );
				buttonNode.onclick = _editLink;
				controls.appendChild( buttonNode );
			}

			if ( ANNOTATION_ACCESS || annotation.getAccess() != ANNOTATION_ACCESS_DEFAULT )
			{
				// add the access button
				// even if the feature is turned off, show this if the access is not
				// what's expected - this is a subtle way of at least letting users
				// know something may be amiss
				buttonNode = document.createElement( "button" );
				buttonNode.setAttribute( 'type', "button" );
				buttonNode.className = AN_ACCESSBUTTON_CLASS;
				buttonNode.setAttribute( 'title', annotation.getAccess() == AN_PUBLIC_ACCESS ?
					getLocalized( 'public annotation' ) : getLocalized( 'private annotation' ) );
				buttonNode.appendChild( document.createTextNode( annotation.getAccess() == AN_PUBLIC_ACCESS ? AN_SUN_SYMBOL : AN_MOON_SYMBOL ) );
				buttonNode.annotation = annotation;
				buttonNode.onclick = _toggleAnnotationAccess;
				controls.appendChild( buttonNode );
			}
			
			// add the delete button
			var buttonNode = document.createElement( "button" );
			buttonNode.setAttribute( 'type', "button" );
			buttonNode.className = AN_DELETEBUTTON_CLASS;
			buttonNode.setAttribute( 'title', getLocalized( 'delete annotation button' ) );
			buttonNode.appendChild( document.createTextNode( "x" ) );
			buttonNode.annotationId = annotation.getId();
			buttonNode.onclick = _deleteAnnotation;
			controls.appendChild( buttonNode );
		}
		
		// add the text content
		var noteText = document.createElement( 'p' );
		var keyword = marginalia.keywordService.getKeyword( annotation.getNote() );
		if ( ! quoteFound )
			noteText.setAttribute( 'title', getLocalized( 'quote not found' ) + ': \n"' + annotation.getQuote() + '"' );
		else if ( keyword )
			noteText.setAttribute( 'title', keyword.description );
		if ( ! canEdit )
		{
			addClass( noteElement, 'other-user' );
			usernameElement = document.createElement( 'span' );
			addClass( usernameElement, 'username' );
			usernameElement.appendChild( document.createTextNode( annotation.getUserId( ) + ': ' ) );
			noteText.appendChild( usernameElement );
		}
		noteText.appendChild( document.createTextNode( annotation.getNote() ) );
		noteElement.appendChild( noteText );
		
		// Mark the action
		if ( ANNOTATION_ACTIONS && annotation.getAction() )
			addClass( noteElement, AN_ACTIONPREFIX_CLASS + annotation.getAction() );
		
		if ( canEdit )
		{
			// Add edit behavior
			noteText.onclick = _editAnnotation;
		}
		
		// Add note hover behaviors
		noteElement.onmouseover = _hoverAnnotation;
		noteElement.onmouseout = _unhoverAnnotation;
	}

	var alignElement = highlightElement ? highlightElement : this.getNoteAlignElement( annotation );
	if ( null != alignElement )
	{
		// The margin must be relative to a preceding list item.
		var prevNode = null;
		if ( nextNode )
			prevNode = getPrevByTagClass( nextNode, 'li' );
		else
		{
			prevNode = getChildrenByTagClass( noteList, 'li' );
			if ( prevNode )
				prevNode = prevNode[ prevNode.length - 1 ];
		}

		// If there is no preceding note, create a dummy
		if ( null == prevNode )
		{
			prevNode = document.createElement( 'li' );
			prevNode.setAttribute( 'class', AN_DUMMY_CLASS );
			prevNode.className = AN_DUMMY_CLASS;
			noteList.insertBefore( prevNode, nextNode );
		}
		
		var pushdown = this.calculateNotePushdown( marginalia, prevNode, alignElement );
		noteElement.style.marginTop = '' + ( pushdown > 0 ? String( pushdown ) : '0' ) + 'px';
	}
	
	// Insert the note in the list
	noteList.insertBefore( noteElement, nextNode );
	
	return noteElement;
}

/**
 * Show the edit controls for a note
 * This may be a free-form textarea or a drop-down list, depending on the state of the note
 */
PostMicro.prototype.showNoteEdit = function( marginalia, noteElement )
{
	// Since we're editing, set the appropriate class on body
	addClass( getBodyElement( document ), AN_EDITINGNOTE_CLASS );
	
	var annotation = getNestedFieldValue( noteElement, AN_ANNOTATION_FIELD );
	var selectNode = getChildByTagClass( noteElement, 'select', AN_KEYWORDSCONTROL_CLASS, null );
	var editNode = getChildByTagClass( noteElement, 'textarea', null, null );

	if ( AN_EDIT_NOTE_KEYWORDS == annotation.editing )
	{
		if ( null == selectNode )
		{
			var value = annotation.getNote();
			if ( editNode )
			{
				value = editNode.value;
				editNode.parentNode.removeChild( editNode );
			}

			var selectNode = document.createElement( 'select' );
			selectNode.className = AN_KEYWORDSCONTROL_CLASS;
			var keywords = marginalia.keywordService.keywords;
			selectNode.onkeypress = _editNoteKeypress;
			
			// See if the current value of the note is a keyword
			if ( ! marginalia.keywordService.isKeyword( annotation.getNote() ) && annotation.getNote() )
			{
				// First option is the freeform edit value for the note
				var opt = document.createElement( 'option' );
				opt.appendChild( document.createTextNode(
					annotation.getNote().length > 12 ? annotation.getNote().substring( 0, 12 ) : annotation.getNote() ) );
				opt.setAttribute( 'value', annotation.getNote() );
				selectNode.appendChild( opt );
			}
			
			for ( var i = 0;  i < keywords.length;  ++i )
			{
				var keyword = keywords[ i ];
				opt = document.createElement( 'option' );
				if ( value == keyword.name )
					opt.setAttribute( 'selected', 'selected' );
				opt.appendChild( document.createTextNode( keyword.name ) );
				opt.setAttribute( 'value', keyword.name );
				opt.setAttribute( 'title', keyword.description );
				selectNode.appendChild( opt );
			}
			noteElement.appendChild( selectNode );
		}
		return selectNode;
	}
	else if ( AN_EDIT_NOTE_FREEFORM == annotation.editing )
	{
		var value = annotation.getNote();
		if ( selectNode )
		{
			if ( -1 != selectNode.selectedIndex )
				value = selectNode.options[ selectNode.selectedIndex ].value;
			selectNode.parentNode.removeChild( selectNode );
		}
		if ( null == editNode )
		{
			// Create the edit box
			var editNode = document.createElement( "textarea" );
			editNode.rows = 3;
			editNode.appendChild( document.createTextNode( value ) );
			noteElement.appendChild( editNode );

			// Set focus after making visible later (IE requirement; it would be OK to do it here for Gecko)
			//editNode.onkeyup = function( event ) { event = getEvent( event ); return postMicro.editKeyUp( event, this ); };
			editNode.annotationId = annotation.getId();
			editNode.onkeypress = _editNoteKeypress;
			editNode.onkeyup = _editChangedKeyup;
		}
		return editNode;
	}
}

 
/**
 * Position the notes for an annotation next to the highlight
 * It is not necessary to call this method when creating notes, only when the positions of
 * existing notes are changing
 */
PostMicro.prototype.positionNote = function( marginalia, annotation )
{
	var note = document.getElementById( AN_ID_PREFIX + annotation.getId() );
	while ( null != note )
	{
		var alignElement = this.getNoteAlignElement( annotation );
		// Don't push down if no align element was found
		if ( null != alignElement )
		{
			var pushdown = this.calculateNotePushdown( marginalia, note.previousSibling, alignElement );
			note.style.marginTop = ( pushdown > 0 ? String( pushdown ) : '0' ) + 'px';
		}
		note = note.nextSibling;
	}
}

/**
 * Determine where an annotation note should be aligned vertically
 */
PostMicro.prototype.getNoteAlignElement = function( annotation )
{
	// Try to find the matching highlight element
	var alignElement = getChildByTagClass( this.contentElement, 'em', AN_ID_PREFIX + annotation.getId(), null );
	// If there is no matching highlight element, pick the paragraph.  Prefer XPath range representation.
	if ( null == alignElement && annotation.getRange( XPATH_RANGE ) )
		alignElement = annotation.getRange( XPATH_RANGE ).start.getReferenceElement( this.contentElement );
	if ( null == alignElement && annotation.getRange( SEQUENCE_RANGE ) )
		alignElement = annotation.getRange( SEQUENCE_RANGE ).start.getReferenceElement( this.contentElement );
	return alignElement;
}

/**
 * Calculate the pixel offset from the previous displayed note to this one
 * by setting the top margin to the appropriate number of pixels.
 * The previous note and the highlight must already be displayed, but this note
 * does not yet need to be part of the DOM.
 */
PostMicro.prototype.calculateNotePushdown = function( marginalia, previousNoteElement, alignElement )
{
	var noteY = getElementYOffset( previousNoteElement, null ) + previousNoteElement.offsetHeight;
	var alignY = getElementYOffset( alignElement, null );
	return alignY - noteY;
}

/**
 * Reposition notes, starting with the note list element passed in
 * Repositioning consists of two things:
 * 1. Updating the margin between notes
 * 2. Collapsing a note if the two notes following it are both pushed down
 */
PostMicro.prototype.repositionNotes = function( marginalia, element )
{
	// We don't want the browser to scroll, which it might under some circumstances
	// (I believe it's a timing thing)
	while ( element )
	{
		var annotation = element.annotation;
		if ( annotation )
		{
			var alignElement = this.getNoteAlignElement( annotation );
			if ( alignElement )
			{
				var goback = false;
				var previous = element.previousSibling;
				var pushdown = this.calculateNotePushdown( marginalia, previous, alignElement );

			/* uncomment this to automatically collapse some notes: *
				// If there's negative pushdown, check whether the preceding note also has pushdown
				if ( pushdown < 0
					&& previous 
					&& previous.annotation 
					&& ! hasClass( previous, AN_NOTECOLLAPSED_CLASS )
					&& previous.pushdown
					&& previous.pushdown < 0 )
				{
					// So now two in a row have negative pushdown.
					// Go back two elements and collapse, then restart pushdown 
					// calculations at the previous element.
					var collapseElement = previous.previousSibling;
					if ( collapseElement && collapseElement.annotation )
					{
						addClass( collapseElement, AN_NOTECOLLAPSED_CLASS );
						element = previous;
						goback = true;
					}
				}
			*/
				// If we didn't have to go back and collapse a previous element,
				// set this note's pushdown correctly.
				if ( ! goback )
				{
					element.style.marginTop = ( pushdown > 0 ? String( pushdown ) : '0' ) + 'px';
					removeClass( element, AN_NOTECOLLAPSED_CLASS );
					element.pushdown = pushdown;
				}
			}
		}
		element = element.nextSibling;
	}
}


/**
 * Reposition a note and any following notes that need it
 * Stop when a note is found that doesn't need to be pushed down
 */
PostMicro.prototype.repositionSubsequentNotes = function( marginalia, firstNote )
{
	for ( note = firstNote;  note;  note = note.nextSibling )
	{
		if ( ELEMENT_NODE == note.nodeType && note.annotation )
		{
			var alignElement = this.getNoteAlignElement( note.annotation );
			if ( alignElement )
			{
				var pushdown = this.calculateNotePushdown( marginalia, note.previousSibling, alignElement );
				if ( note.pushdown && note.pushdown == pushdown )
					break;
				note.style.marginTop = ( pushdown > 0 ? String( pushdown ) : '0' ) + 'px';
				note.pushdown = pushdown;
			}
		}
	}
}


/**
 * Remove an note from the displayed list
 * Returns the next list item in the list
 */
PostMicro.prototype.removeNote = function( marginalia, annotation )
{
	var listItem = document.getElementById( AN_ID_PREFIX + annotation.getId() );
	var next = getNextByTagClass( listItem, 'li' );
	listItem.parentNode.removeChild( listItem );
	listItem.annotation = null; // dummy item won't have this field
	clearEventHandlers( listItem, true );	
	return next;
}

/**
 * Click on annotation to edit it
 */
function _editAnnotation( event )
{
	event = getEvent( event );
	stopPropagation( event );
	var marginalia = window.marginalia;
	var post = getNestedFieldValue( this, AN_POST_FIELD );
	var annotation = getNestedFieldValue( this, AN_ANNOTATION_FIELD );
	if ( ! annotation.isDeleted )
	{
		// Ensure the window doesn't scroll by saving and restoring scroll position
		var scrollY = getWindowYScroll( );
		var scrollX = getWindowXScroll( );
		
		annotation.editing = annotation.defaultNoteEditMode( );
		var nextNode = post.removeNote( marginalia, annotation );
		var noteElement = post.showNote( marginalia, annotation, nextNode );
		post.repositionNotes( marginalia, noteElement.nextSibling );
		
		var editElement = ( AN_EDIT_NOTE_KEYWORDS == annotation.editing )
			? getChildByTagClass( noteElement, null, AN_KEYWORDSCONTROL_CLASS, null )
			: getChildByTagClass( noteElement, 'textarea', null, null );
		
		// It is absolutely essential that the element get the focus - otherwise, the
		// textarea will sit around looking odd until the user clicks *in* and then *out*,
		// which behavior would be most unimpressive.
		editElement.focus( );
		// Yeah, ain't IE great.  You gotta focus TWICE for it to work.  I don't
		// want to burden other browsers with its childish antics.
		if ( 'exploder' == detectBrowser( ) )
			editElement.focus( );
		
		window.scrollTo( scrollX, scrollY );
	}
}

/**
 * Hit a key while editing an annotation note
 * Handles Enter to save
 */
function _editNoteKeypress( event )
{
	event = getEvent( event );
	var target = getEventTarget( event );
	var post = getNestedFieldValue( target, AN_POST_FIELD );
	var annotation = getNestedFieldValue( target, AN_ANNOTATION_FIELD );
	if ( event.keyCode == 13 )
	{
		post.saveAnnotation( window.marginalia, annotation );
		return false;
	}
	// should check for 27 ESC to cancel edit
	else
	{
		return true;
	}
}


/**
 * Update a text field to indicate whether its content has changed when a key is pressed
 */
function _editChangedKeyup( event )
{
	event = getEvent( event );
	var target = getEventTarget (event );
	var annotation = getNestedFieldValue( target, AN_ANNOTATION_FIELD );
	if ( target.value != annotation.note )
		addClass( target, AN_EDITCHANGED_CLASS );
	else
		removeClass( target, AN_EDITCHANGED_CLASS );
}		


/**
 * Annotation edit loses focus
 */
function _saveAnnotation( event )
{
	// Note that the MS event model doesn't provide info about which element triggered this event
	// so avoid using the event field - look up the currently-edited node instead
	var note = getChildByTagClass( document.documentElement, 'li', AN_EDITINGNOTE_CLASS, null );
	// var post = getParentByTagClass( note, null, 'post', false, null );
	var post = getNestedFieldValue( note, AN_POST_FIELD );
	var annotation = getNestedFieldValue( note, AN_ANNOTATION_FIELD );
	post.saveAnnotation( window.marginalia, annotation );
}

/**
 * Click annotation delete button
 */
function _deleteAnnotation( event )
{
	event = getEvent( event );
	stopPropagation( event );
	var post = getNestedFieldValue( this, AN_POST_FIELD );
	var annotation = getNestedFieldValue( this, AN_ANNOTATION_FIELD );
	post.deleteAnnotation( window.marginalia, annotation );
}

/**
 * Click the expand/collapse edit button
 */
function _expandEdit( event )
{
	event = getEvent( event );
	stopPropagation( event );
	var annotation = getNestedFieldValue( this, AN_ANNOTATION_FIELD );
	var post = getNestedFieldValue( this, AN_POST_FIELD );
	var target = getEventTarget( event );
	var noteElement = getParentByTagClass( target, 'li', null, false, null );
	var expandControl = getChildByTagClass( noteElement, 'button', AN_EXPANDBUTTON_CLASS, null );
	while ( expandControl.firstChild )
		expandControl.removeChild( expandControl.firstChild );
	
	if ( AN_EDIT_NOTE_KEYWORDS == annotation.editing )
	{
		expandControl.appendChild( document.createTextNode( AN_EXPANDED_ICON ) );
		annotation.editing = AN_EDIT_NOTE_FREEFORM;
	}
	else
	{
		// Must save the text value as a possible option in the drop-down, otherwise
		// it will be lost.
		var editNode = getChildByTagClass( noteElement, 'textarea', null, null );
		// If the text is too long, just chop it (popping up a dialog is too
		// complex and wrecks the flow)
		if ( editNode.value.length > MAX_NOTE_LENGTH )
			annotation.setNote( editNode.value.substr( 0, MAX_NOTE_LENGTH ) );
		else
			annotation.setNote( editNode.value );
		expandControl.appendChild( document.createTextNode( AN_COLLAPSED_ICON ) );
		annotation.editing = AN_EDIT_NOTE_KEYWORDS;
	}
	
	var editControl = post.showNoteEdit( marginalia, noteElement );
}

/**
 * Click annotation access button
 */
function _toggleAnnotationAccess( event )
{
	event = getEvent( event );
	stopPropagation( event );

	var annotation = getNestedFieldValue( this, AN_ANNOTATION_FIELD );
	var accessButton = getEventTarget( event );

	annotation.setAccess( annotation.getAccess() == 'public' ? 'private' : 'public' );
	window.marginalia.updateAnnotation( annotation, null );
	while ( accessButton.firstChild )
		accessButton.removeChild( accessButton.firstChild );
	accessButton.appendChild( document.createTextNode( annotation.getAccess() == 'public' ? AN_SUN_SYMBOL : AN_MOON_SYMBOL ) );
	accessButton.setAttribute( 'title', annotation.getAccess() == 'public' ?
		getLocalized( 'public annotation' ) : getLocalized( 'private annotation' ) );
}

