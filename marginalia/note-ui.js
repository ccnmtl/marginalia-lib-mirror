/*
 * note-ui.js
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
		var t = domutil.childByTagClass( this.element, null, AN_NOTES_CLASS, _skipPostContent );
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


PostMicro.prototype.getNoteId = function( annotation )
{
//	assert( typeof annotationId == 'number' );
	return AN_ID_PREFIX + annotation.getId();
}

/**
 * Find or create the list item for a margin note
 * nextNode - the node following this list element in the margin
 */
PostMicro.prototype.showNoteElement = function( marginalia, annotation, nextNode )
{
	var postMicro = this;
	var noteList = this.getNotesElement( marginalia );

	// Will need to align the note with the highlight.
	// If the highlight is not found, then the quote doesn't match - display
	// the annotation, but with an error and deactivate some behaviors.
	var highlightElement = domutil.childByTagClass( this.contentElement, 'em', AN_ID_PREFIX + annotation.getId(), null );
	var quoteFound = highlightElement != null;
	
	// Find or create the list item
	var noteElement = document.getElementById( this.getNoteId( annotation ) );
	if ( noteElement )
	{
		trace( 'showNote', ' Note already present' );
		this.clearNote( marginalia, annotation );
		if ( ! quoteFound )
			domutil.setClass( noteElement, AN_QUOTENOTFOUND_CLASS, quoteFound );
	}
	else
	{
		trace( 'showNote', ' Create new note' );
		var noteElement = domutil.element( 'li', {
			id:  AN_ID_PREFIX + annotation.getId(),
			className:  quoteFound ? '' : AN_QUOTENOTFOUND_CLASS,
			annotation:  annotation } );

		// Align the note (takes no account of subsequent notes, which is OK because this note
		// hasn't yet been filled out)
		var alignElement = highlightElement ? highlightElement : this.getNoteAlignElement( annotation );
		if ( null != alignElement )
		{
			// The margin must be relative to a preceding list item.
			var prevNode = null;
			if ( nextNode )
				prevNode = domutil.prevByTagClass( nextNode, 'li' );
			else
			{
				prevNode = domutil.childrenByTagClass( noteList, 'li' );
				if ( prevNode )
					prevNode = prevNode[ prevNode.length - 1 ];
			}
	
			// If there is no preceding note, create a dummy
			if ( null == prevNode )
			{
				prevNode = domutil.element( 'li', { className:  AN_DUMMY_CLASS } );
				noteList.insertBefore( prevNode, nextNode );
			}
			
			var pushdown = this.calculateNotePushdown( marginalia, prevNode, alignElement );
			noteElement.style.marginTop = '' + ( pushdown > 0 ? String( pushdown ) : '0' ) + 'px';
		}
		
		// Insert the note in the list
		trace( 'showNote', ' Note ' + noteElement + ' inserted before ' + nextNode + ' in ' + noteList + '(' + noteList.parentNode + ')');
		noteList.insertBefore( noteElement, nextNode );
	}	

	// Add note hover behaviors
	addEvent( noteElement, 'mouseover', _hoverAnnotation );
	addEvent( noteElement, 'mouseout', _unhoverAnnotation );
	
	return noteElement;
}


/**
 * Show a note in the margin
 * Regular annotation display with control buttons (delete, access, link)
 * Call showEdit if you want to show an editor instead
 */
PostMicro.prototype.showNote = function( marginalia, annotation, nextNode )
{
	trace( 'showNote', 'Show note ' + annotation.toString() );

	var noteElement = this.showNoteElement( marginalia, annotation, nextNode );
	
	// Mark the action
	if ( marginalia.showActions && annotation.getAction() )
		domutil.addClass( noteElement, AN_ACTIONPREFIX_CLASS + annotation.getAction() );
	
	// Calculating these parameters here makes it much easier to implement note display
	var params = {
		isCurrentUser: null != marginalia.username && annotation.getUserId( ) == marginalia.username,
		linkingEnabled: marginalia.linkUi ? true : false,
		quoteFound: null != domutil.childByTagClass( this.contentElement, 'em', AN_ID_PREFIX + annotation.getId(), null),
		keyword: marginalia.keywordService ? marginalia.keywordService.getKeyword( annotation.getNote() ) : null
	};
	
	// Generate actual display elements and get behavior rules
	 marginalia.displayNote( marginalia, annotation, noteElement, params );
	 
	return noteElement;
}

Marginalia.prototype.bindNoteBehaviors = function( annotation, noteElement, behaviors )
{
	var marginalia = this;
	var postMicro = domutil.nestedFieldValue( noteElement, AN_POST_FIELD );

	// Functions to associate with events (click etc.)
	var eventMappings = { 
		link: function() {
			postMicro.showNoteEditor( annotation, new SimpleLinkUi( ), noteElement );
		},
		access: _toggleAnnotationAccess,
		'delete': _deleteAnnotation,
		edit: _editAnnotation,
		save: _saveAnnotation };
		
	// Apply behavior rules
	// These are separated out to insulate display implementations from changes to internal APIs
	for ( var i = 0;  i < behaviors.length;  ++i )
	{
		var nodes = cssQuery( behaviors[ i ][ 0 ], noteElement );
		if ( nodes.length == 1 )
		{
			var node = nodes[ 0 ];
			var props = behaviors[ i ][ 1 ];
			for ( var property in props )
			{
				var value = props[ property ];
				switch ( property )
				{
					case 'click':
						addEvent( node, 'click', eventMappings[ value ] );
						break;
					default:
						trace( 'behaviors', 'Unknown property: ' + property );
				}
			}
		}
		else
			trace( 'behaviors', 'Show note behavior unable to find node: ' + behaviors[ i ][ 0 ] );
	}
}


/**
 * Default function for generating margin note display, stored in marginalia.displayNote
 */
Marginalia.defaultDisplayNote = function( marginalia, annotation, noteElement, params )
{
	if ( params.isCurrentUser )
	{
		var controls = domutil.element( 'div', { className: 'controls' } );
		noteElement.appendChild( controls );
		
		// add the link button
		if ( params.linkingEnabled )
		{
			controls.appendChild( domutil.button( {
				className:  AN_LINKBUTTON_CLASS,
				title:  getLocalized( 'annotation link button' ),
				content:  AN_LINK_EDIT_ICON
			} ) );
		}

		// add the access button
		if ( marginalia.showAccess )
		{
			controls.appendChild( domutil.button( {
				className:  AN_ACCESSBUTTON_CLASS,
				title:  getLocalized( annotation.getAccess() == AN_PUBLIC_ACCESS ? 'public annotation' : 'private annotation' ),
				content:  annotation.getAccess() == AN_PUBLIC_ACCESS ? AN_SUN_SYMBOL : AN_MOON_SYMBOL
			} ) );
		}
		
		// add the delete button
		controls.appendChild( domutil.button( {
			className:  AN_DELETEBUTTON_CLASS,
			title:  getLocalized( 'delete annotation button' ),
			content:  'x'
		} ) );
	}
	
	// add the text content
	var noteText = document.createElement( 'p' );
	var titleText = null;

	if ( ! params.quoteFound || ! annotation.getRange( SEQUENCE_RANGE ) )
		titleText = getLocalized( 'quote not found' ) + ': \n"' + annotation.getQuote() + '"';
	else if ( params.keyword )
		titleText = params.keyword.description;
	
	if ( titleText )
		noteText.setAttribute( 'title', titleText );
	
	// If this doesn't belong to the current user, add the name of the owning user
	if ( ! params.isCurrentUser )
	{
		domutil.addClass( noteElement, 'other-user' );
		noteText.appendChild( domutil.element( 'span', {
			className:  'username',
			content:  annotation.getUserId( ) + ': ' } ) );
	}
	noteText.appendChild( document.createTextNode( annotation.getNote() ) );
	noteElement.appendChild( noteText );
	
	// Return behavior mappings
	marginalia.bindNoteBehaviors( annotation, noteElement, [
		[ 'button.annotation-link', { click: 'link' } ],
		[ 'button.annotation-access', { click: 'access' } ],
		[ 'button.annotation-delete', { click: 'delete' } ],
		[ 'p', { click: 'edit' } ]
	] );
}


/**
 * Show a note editor in the margin
 * If there's already a note editor present, remove it
 */
PostMicro.prototype.showNoteEditor = function( marginalia, annotation, editor, nextNode )
{
	var noteElement = this.showNoteElement( marginalia, annotation, nextNode );

	// Check whether there's already an editor present.  If so, remove it.
	// annotationOrig is a backup of the original unchanged annotation.  It can be used
	// to restore the original annotation state if the edit is cancelled.
	var setEvents = false;
	if ( marginalia.noteEditor )
	{
		editor.annotationOrig = marginalia.noteEditor.annotationOrig;
		if ( marginalia.noteEditor.save )
			marginalia.noteEditor.save( );
		if ( marginalia.noteEditor.clear )
			marginalia.noteEditor.clear( );
		while ( noteElement.firstChild )
			noteElement.removeChild( noteElement.firstChild );
	}
	else
	{
		// Since we're editing, set the appropriate class on body
		domutil.addClass( document.body, AN_EDITINGNOTE_CLASS );
		domutil.addClass( noteElement, AN_EDITINGNOTE_CLASS );
		setEvents = true;
		editor.annotationOrig = clone( annotation );
	}

	// Initialize the new editor
	editor.marginalia = marginalia;
	editor.postMicro = this;
	editor.annotation = annotation;
	editor.noteElement = noteElement;

	marginalia.noteEditor = editor;
	editor.show( );
	editor.focus( );

	// If anywhere outside the note area is clicked, the annotation will be saved.
	// Beware serious flaws in IE's model (see addAnonBubbleEventListener code for details),
	// so this only works because I can figure out which element was clicked by looking for
	// AN_EDITINGNOTE_CLASS.
	addEvent( document.documentElement, 'click', _saveAnnotation );
	addEvent( noteElement, 'click', domutil.stopPropagation );

	// Display link editing
//	else if ( AN_EDIT_LINK == annotation.editing )
//		marginalia.linkUi.showLinkEdit( marginalia, this, annotation, noteElement );
	return noteElement;
}


/**
 * Freeform margin note editor
 */
function FreeformNoteEditor( )
{
	this.editNode = null;
}

FreeformNoteEditor.prototype.clear = function( )
{
	this.editNode = null;
}

FreeformNoteEditor.prototype.save = function( )
{
	this.annotation.setNote( this.editNode.value );
}

FreeformNoteEditor.prototype.show = function( )
{
	var postMicro = this.postMicro;
	var marginalia = this.marginalia;
	var annotation = this.annotation;
	var noteElement = this.noteElement;
	
	// If keywords are enabled, show the expand/collapse control
	if ( this.marginalia.keywordService )
	{
		var f = function( event ) {
			postMicro.showNoteEditor( marginalia, annotation, new KeywordNoteEditor( ) );
		};
		this.noteElement.appendChild( domutil.button( {
			className:	AN_EXPANDBUTTON_CLASS,
			title: 'annotation expand edit button',
			content: AN_EXPANDED_ICON,
			onclick: f } ) );
	}

	// Create the edit box
	this.editNode = document.createElement( "textarea" );
	this.editNode.rows = 3;
	this.editNode.appendChild( document.createTextNode( annotation.getNote() ) );

	// Set focus after making visible later (IE requirement; it would be OK to do it here for Gecko)
	this.editNode.annotationId = this.annotation.getId();
	addEvent( this.editNode, 'keypress', _editNoteKeypress );
	addEvent( this.editNode, 'keyup', _editChangedKeyup );
	
	this.noteElement.appendChild( this.editNode );
}

FreeformNoteEditor.prototype.focus = function( )
{
	this.editNode.focus( );
	// Yeah, ain't IE great.  You gotta focus TWICE for it to work.  I don't
	// want to burden other browsers with its childish antics.
	if ( 'exploder' == domutil.detectBrowser( ) )
		this.editNode.focus( );
}
		

/**
 * Keyword margin note editor
 */
function KeywordNoteEditor( )
{
	this.selectNode = null;
}

KeywordNoteEditor.prototype.clear = function( )
{
	this.selectNode = null;
}

KeywordNoteEditor.prototype.save = function( )
{
	if ( -1 != this.selectNode.selectedIndex )
		this.annotation.setNote( this.selectNode.options[ this.selectNode.selectedIndex ].value );
}

KeywordNoteEditor.prototype.show = function( )
{
	var postMicro = this.postMicro;
	var marginalia = this.marginalia;
	var annotation = this.annotation;
	var noteElement = this.noteElement;

	// Show the expand/collapse control
	var f = function( event ) {
		postMicro.showNoteEditor( marginalia, annotation, new FreeformNoteEditor( ) );
	};
	this.noteElement.appendChild( domutil.button( {
		className:	AN_EXPANDBUTTON_CLASS,
		title: 'annotation expand edit button',
		content: AN_COLLAPSED_ICON,
		onclick: f } ) );
	
	this.selectNode = document.createElement( 'select' );
	
	this.selectNode.className = AN_KEYWORDSCONTROL_CLASS;
	var keywords = marginalia.keywordService.keywords;
	addEvent( this.selectNode, 'keypress', _editNoteKeypress );
	
	// See if the current value of the note is a keyword
	if ( ! marginalia.keywordService.isKeyword( annotation.getNote() ) && annotation.getNote() )
	{
		// First option is the freeform edit value for the note
		var opt = document.createElement( 'option' );
		opt.appendChild( document.createTextNode(
			annotation.getNote().length > 12 ? annotation.getNote().substring( 0, 12 ) : annotation.getNote() ) );
		opt.setAttribute( 'value', annotation.getNote() );
		this.selectNode.appendChild( opt );
	}
	
	var value = annotation.getNote();
	for ( var i = 0;  i < keywords.length;  ++i )
	{
		var keyword = keywords[ i ];
		opt = document.createElement( 'option' );
		if ( value == keyword.name )
			opt.setAttribute( 'selected', 'selected' );
		opt.appendChild( document.createTextNode( keyword.name ) );
		opt.setAttribute( 'value', keyword.name );
		opt.setAttribute( 'title', keyword.description );
		this.selectNode.appendChild( opt );
	}
	
	this.noteElement.appendChild( this.selectNode );
}

KeywordNoteEditor.prototype.focus = function( )
{
	this.selectNode.focus( );
	if ( 'exploder' == domutil.detectBrowser( ) )
		this.selectNode.focus( );
}


function DummyNoteEditor( f )
{
	this.f = f;
}

DummyNoteEditor.show = function( )
{
	this.f( this );
}

 
/**
 * Position the notes for an annotation next to the highlight
 * It is not necessary to call this method when creating notes, only when the positions of
 * existing notes are changing
 */
PostMicro.prototype.positionNote = function( marginalia, annotation )
{
	var note = annotation.getNoteElement( );
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
	var alignElement = domutil.childByTagClass( this.contentElement, 'em', AN_ID_PREFIX + annotation.getId(), null );
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
	var noteY = domutil.getElementYOffset( previousNoteElement, null ) + previousNoteElement.offsetHeight;
	var alignY = domutil.getElementYOffset( alignElement, null );
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
					domutil.removeClass( element, AN_NOTECOLLAPSED_CLASS );
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
	var listItem = annotation.getNoteElement( );
	var next = domutil.nextByTagClass( listItem, 'li' );
	listItem.parentNode.removeChild( listItem );
	listItem.annotation = null; // dummy item won't have this field
	domutil.clearEventHandlers( listItem, true );	
	return next;
}

/**
 * Remove the contents of a not element (but keep the element - it may have
 * important class/id etc. values on it.
 */
PostMicro.prototype.clearNote = function( marginalia, annotation )
{
	var note = annotation.getNoteElement( );
	domutil.clearEventHandlers( note, true, true );
	while ( note.firstChild )
		note.removeChild( note.firstChild );
	return note;
}


/**
 * Click on annotation to edit it
 */
function _editAnnotation( event )
{
	var marginalia = window.marginalia;

	// If an annotation is already being edited, return (don't stop propagation)
	if ( marginalia.editing )
		return;
	
	event.stopPropagation( );
	
	var post = domutil.nestedFieldValue( this, AN_POST_FIELD );
	var annotation = domutil.nestedFieldValue( this, AN_ANNOTATION_FIELD );

	// Ensure the window doesn't scroll by saving and restoring scroll position
	var scrollY = domutil.getWindowYScroll( );
	var scrollX = domutil.getWindowXScroll( );
	
	var nextNode = post.removeNote( marginalia, annotation );
	var editor = marginalia.getEditor( marginalia, annotation );
	var noteElement = post.showNoteEditor( marginalia, annotation, editor, nextNode );
	post.repositionNotes( marginalia, noteElement.nextSibling );
	
	var editElement = ( AN_EDIT_NOTE_KEYWORDS == annotation.editing )
		? domutil.childByTagClass( noteElement, null, AN_KEYWORDSCONTROL_CLASS, null )
		: domutil.childByTagClass( noteElement, 'textarea', null, null );
	
	// It is absolutely essential that the element get the focus - otherwise, the
	// textarea will sit around looking odd until the user clicks *in* and then *out*,
	// which behavior would be most unimpressive.
	editor.focus( );
	
	window.scrollTo( scrollX, scrollY );
}


/**
 * Hit a key while editing an annotation note
 * Handles Enter to save
 */
function _editNoteKeypress( event )
{
	var target = domutil.getEventTarget( event );
	var post = domutil.nestedFieldValue( target, AN_POST_FIELD );
	var annotation = domutil.nestedFieldValue( target, AN_ANNOTATION_FIELD );
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
	var target = domutil.getEventTarget( event );
	var annotation = domutil.nestedFieldValue( target, AN_ANNOTATION_FIELD );
	if ( target.value != annotation.note )
		domutil.addClass( target, AN_EDITCHANGED_CLASS );
	else
		domutil.removeClass( target, AN_EDITCHANGED_CLASS );
}


/**
 * Annotation edit loses focus
 */
function _saveAnnotation( event )
{
	// Can't truest IE events for information, so go elsewhere
	var annotation = marginalia.noteEditor.annotation;
	var post = marginalia.noteEditor.postMicro;
	post.saveAnnotation( window.marginalia, annotation );
}

/**
 * Click annotation delete button
 */
function _deleteAnnotation( event )
{
	event.stopPropagation( );
	var post = domutil.nestedFieldValue( this, AN_POST_FIELD );
	var annotation = domutil.nestedFieldValue( this, AN_ANNOTATION_FIELD );
	post.deleteAnnotation( window.marginalia, annotation );
}

/**
 * Click the expand/collapse edit button
 */
function _expandEdit( event )
{
	event.stopPropagation( );
	var target = domutil.getEventTarget( event );
	var annotation = domutil.nestedFieldValue( this, AN_ANNOTATION_FIELD );
	var post = domutil.nestedFieldValue( this, AN_POST_FIELD );
	var noteElement = domutil.parentByTagClass( target, 'li', null, false, null );
	var expandControl = domutil.childByTagClass( noteElement, 'button', AN_EXPANDBUTTON_CLASS, null );
	while ( expandControl.firstChild )
		expandControl.removeChild( expandControl.firstChild );
	
	if ( AN_EDIT_NOTE_KEYWORDS == annotation.editing )
	{
		expandControl.appendChild( document.createTextNode( AN_EXPANDED_ICON ) );
		post.showNoteEditor( marginalia, annotation, new FreeformNoteEditor( ) );
	}
	else
	{
		expandControl.appendChild( document.createTextNode( AN_COLLAPSED_ICON ) );
		post.showNoteEditor( marginalia, annotation, new KeywordNoteEditor( ) );
	}
}

/**
 * Click annotation access button
 */
function _toggleAnnotationAccess( event )
{
	event.stopPropagation( );
	var target = domutil.getEventTarget( event );
	
	var annotation = domutil.nestedFieldValue( this, AN_ANNOTATION_FIELD );
	var accessButton = target;

	annotation.setAccess( annotation.getAccess() == 'public' ? 'private' : 'public' );
	window.marginalia.updateAnnotation( annotation, null );
	while ( accessButton.firstChild )
		accessButton.removeChild( accessButton.firstChild );
	accessButton.appendChild( document.createTextNode( annotation.getAccess() == 'public' ? AN_SUN_SYMBOL : AN_MOON_SYMBOL ) );
	accessButton.setAttribute( 'title', annotation.getAccess() == 'public' ?
		getLocalized( 'public annotation' ) : getLocalized( 'private annotation' ) );
}

