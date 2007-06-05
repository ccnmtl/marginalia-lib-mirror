/*
 * marginalia.js
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

// The names of HTML/CSS classes used by the annotation code.
AN_NOTES_CLASS = 'notes';			// the notes portion of a fragment
AN_HIGHLIGHT_CLASS = 'annotation';// class given to em nodes for highlighting
AN_LINK_CLASS = 'annotation-link';	// class given to a nodes for link annotations
AN_HOVER_CLASS = 'hover';			// assigned to highlights and notes when the mouse is over the other
AN_ANNOTATED_CLASS = 'annotated';	// class added to fragment when annotation is on
AN_SELFANNOTATED_CLASS = 'self-annotated';  // annotations are by the current user (and therefore editable)
AN_DUMMY_CLASS = 'dummy';			// used for dummy item in note list
AN_RANGEMISMATCH_ERROR_CLASS = 'annotation-range-mismatch';	// one or more annotations don't match the current state of the document
AN_EDITINGNOTE_CLASS = 'editing-note';		// (on body) indicates a note is being edited
AN_EDITINGLINK_CLASS = 'editing-link';
AN_EDITCHANGED_CLASS = 'changed';	// indicates content of a text edit changed
AN_LASTHIGHLIGHT_CLASS = 'last';	// used to flag the last highlighted regin for a single annotation

// Classes to identify specific controls
AN_LINKBUTTON_CLASS = 'annotation-link';
AN_ACCESSBUTTON_CLASS = 'annotation-access';
AN_DELETEBUTTON_CLASS = 'annotation-delete';
AN_EXPANDBUTTON_CLASS = 'expand-edit';
AN_KEYWORDSCONTROL_CLASS = 'keywords';

AN_ANNOTATION_FIELD = 'annotation';	// reference to Annotation object
AN_POST_FIELD = 'post';				// reference to PostMicro object

AN_ID_PREFIX = 'annot';				// prefix for annotation IDs in element classes and IDs
AN_SUN_SYMBOL = '\u25cb'; //'\u263c';
AN_MOON_SYMBOL = '\u25c6'; //'\u2641';
AN_LINK_ICON = '\u263c'; //'\u238b'; circle-arrow // \u2318 (point of interest) \u2020 (dagger) \u203b (reference mark) \u238b (circle arrow)
AN_LINK_EDIT_ICON = '\u263c'; //'\u238b'; circle-arrow// \u2021 (double dagger)
AN_COLLAPSED_ICON = '+'; // '\u25b7'; triangle
AN_EXPANDED_ICON = '-'; // '\u25bd';
AN_LINKEDIT_LABEL = '\u263c'; // '\u238b'; circle-arrow

// Length limits
MAX_QUOTE_LENGTH = 1000;
MAX_NOTE_LENGTH = 250;
MAX_NOTEHOVER_LENGTH = 24;
MAX_LINK_LENGTH = 255;

// The timeout between coop multitasking calls.  Should be short so most time is spent doing
// something rather than timing out.
AN_COOP_TIMEOUT = 10;

// The maximum time to spend on one coop multitasking call.  Should be short enough to be
// fairly unnoticeable, but long enough to get some work done.
AN_COOP_MAXTIME = 240;

/* ************************ User Functions ************************ */

/*
 * Must be called before any other annotation functions
 * service - used to connect to the server side
 * anuser - the user whose annotations are to be shown
 * thisuser - the current user (may differ from anuser)
 * urlBase - if null, annotation URLs are used as normal.  Otherwise, they are searched for this
 * string and anything preceeding it is chopped off.  This is necessary because IE lies about
 * hrefs:  it provides an absolute URL for that attribute, rather than the actual text.  In some
 * cases, absolute URLs aren't desirable (e.g. because the annotated resources might be moved
 * to another host, in which case the URLs would all break).
 */
function marginaliaInit( service, thisuser, anuser, urlBase, preferences, keywordService )
{
	window.marginalia = new Marginalia( service, thisuser, anuser, urlBase, preferences, keywordService );

	// Event handlers
	if ( document.addEventListener )
		document.addEventListener( 'keyup', _keyupCreateAnnotation, false );
	else  // for IE:
	{
		if ( document.onkeyup )
			document.onkeyup = function( event ) { _keyupCreateAnnotation(event); document.onkeyup; }
		else
			document.onkeyup = _keyupCreateAnnotation;
	}
	
	// Click-to-link doesn't work in IE because of its weak event model
	if ( ANNOTATION_LINKING && window.addEventListener )
	{
		window.addEventListener( 'focus', _enableLinkTargets, false );
		window.addEventListener( 'focus', _updateLinks, false );
	}
}


function Marginalia( service, username, anusername, urlBase, preferences, keywordService )
{
	this.urlBase = urlBase;
	this.annotationService = service;
	this.username = username;
	this.anusername = anusername;
	this.preferences = preferences;
	this.keywordService = keywordService;
	return this;
}

/**
 * Could do this in the initializer, but by leaving it until now we can avoid
 * forcing clients to have an onload handler
 */
Marginalia.prototype.listPosts = function( )
{
	if ( ! this.posts )
		this.posts = new PostPageInfo( document );
	return this.posts;
}

/**
 * Return a list of all annotations for a given url (and possibly block).
 * Also delete any existing annotations.
 * TODO: separate these two functionalities into different, clearly-labeled functions
 */
Marginalia.prototype.listAnnotations = function( url, block, f )
{
	var r = this.annotationService.listAnnotations( url, this.anusername, block, f );
	// First strip out any existing annotations
	// This used to be done by the callback function, but doing it here has the benefit
	// of getting it done while the server is busy fetching the result.
	var marginalia = window.marginalia;
	var posts = marginalia.listPosts( ).getAllPosts( );
	for ( var i = 0;  i < posts.length;  ++i )
	{
		var post = posts[ i ];
		// Hide any range mismatch error
		removeClass( posts[ i ].element, AN_RANGEMISMATCH_ERROR_CLASS );
		// Should also destruct each annotation
		var annotations = post.removeAnnotations( marginalia );
		for ( var j = 0;  j < annotations.length;  ++j )
			annotations[ j ].destruct( );
		normalizeSpace( post.element );
	}
	return r;
}

Marginalia.prototype.createAnnotation = function( annotation, f )
{
	this.annotationService.createAnnotation( annotation, f );
}

Marginalia.prototype.updateAnnotation = function( annotation )
{
	this.annotationService.updateAnnotation( annotation, null );
}

Marginalia.prototype.deleteAnnotation = function( annotationId )
{
	this.annotationService.deleteAnnotation( annotationId, null );
}


/**
 * Show Marginalia features on the page
 * triggers some CSS classes which can be used to show/hide the annotation margin etc.
 */
Marginalia.prototype.showMarginalia = function( )
{
	var bodyElement = document.getElementsByTagName( 'body' )[ 0 ];
	addClass( bodyElement, AN_ANNOTATED_CLASS );
	if ( this.username == this.anusername )
		addClass( bodyElement, AN_SELFANNOTATED_CLASS );
}


/**
 * Hide Marginalia features on a page
 * This used to be part of hideAllAnnotations, but because it is sometimes necessary
 * to hide the annotations while allowing users to retrieve subsets of them, this
 * function was necessary (along with showMarginalia).
 */
Marginalia.prototype.hideMarginalia = function( )
{
	var bodyElement = document.getElementsByTagName( 'body' )[ 0 ];
	removeClass( bodyElement, AN_ANNOTATED_CLASS );
	removeClass( bodyElement, AN_SELFANNOTATED_CLASS );
}	


/*
 * Show all annotations on the page
 * Make sure to call showMarginalia too
 * There used to be showAnnotations and hideAnnotations functions which could
 * apply to individual posts on a page.  Unused, I removed them - they added
 * complexity because annotations needed to be stored but not displayed.  IMHO,
 * the best way to do this is with simple dynamic CSS (using display:none).
 */
Marginalia.prototype.showAnnotations = function( url, block )
{
	this.listAnnotations( url, block, _showAnnotationsCallback );
}

/*
 * This is the callback function called by listAnnotations when data first comes back
 * from the server.
 */
function _showAnnotationsCallback( xmldoc )
{
	// Existing annotations used to be stripped here.  I moved that to listAnnotations
	// to take advantage of server processing time.
	window.marginalia.annotationXmlCache = xmldoc;
	_annotationDisplayCallback( );
}

/*
 * This callback is used to display annotations from the cache in the marginalia object.
 * It will spend a certain amount of time displaying annotations;  if it can't show them
 * all in that time, it will call setTimeout to trigger continued display later.  This
 * is basically a way to implement cooperative multitasking so that if many annotations
 * need to be displayed the browser won't lock up.
 */
function _annotationDisplayCallback( )
{
	var startTime = new Date( );
	var curTime;
	var marginalia = window.marginalia;
	
	// Parse the XML, if that hasn't been done already
	if ( marginalia.annotationXmlCache )
	{
		marginalia.annotationCache = parseAnnotationXml( marginalia.annotationXmlCache );
		delete marginalia.annotationXmlCache;
		curTime = new Date( );
		if ( curTime - startTime >= AN_COOP_MAXTIME )
		{
			setTimeout( _annotationDisplayCallback, AN_COOP_TIMEOUT );
			return;
		}
	}
	
	// Display cached annotations
	var annotations = marginalia.annotationCache;
	if ( annotations )
	{
		var i;
		for ( i = 0;  i < annotations.length;  ++i )
		{
			if ( null != annotations[ i ] )
			{
				var post = marginalia.listPosts( ).getPostByUrl( annotations[ i ].url );
				if ( -1 == post.addAnnotationPos( marginalia, annotations[ i ], i ) )
				{
					// Make the error message visible by adding a class which can match a CSS
					// rule to display the error appropriately.
					// This doesn't work on... wait for it... Internet Explorer.  However, I don't
					// want to directly display a specific element or add content, because that
					// would be application-specific.  For now, IE will have to do without.
					// TODO: instead of turning the error on or off, actually list the annotations
					// in place (which we can  out from range info)
					addClass( post.element, AN_RANGEMISMATCH_ERROR_CLASS );
				}
				// I figure it's probably cheaper to null them rather than resizing the array
				// each time
				annotations[ i ] = null;
				
				curTime = new Date( );
				if ( curTime - startTime >= AN_COOP_MAXTIME )
					break;
			}
		}
		
		if ( annotations.length == i )
			delete marginalia.annotationCache;
		else
			setTimeout( _annotationDisplayCallback, AN_COOP_TIMEOUT );
	}
}

/**
 * Hide all annotations on the page
 */
Marginalia.prototype.hideAnnotations = function( )
{
	var posts = this.listPosts( ).getAllPosts( );
	for ( var i = 0;  i < posts.length;  ++i )
	{
		var post = posts[ i ];
		removeClass( post.element, AN_RANGEMISMATCH_ERROR_CLASS );
		var annotations = post.removeAnnotations( );
		for ( var j = 0;  j < annotations.length;  ++j )
			annotations[ j ].destruct( );
	}
}


/**
 * Check the location value for the window for a fragment identifier starting
 * with a slash (I know this is illegal, but right now it seems the cleanest
 * way to specify a node within a document).
 *
 * BROKEN for pages with more than one hentry.
 */
function getNodeByFragmentPath( url )
{
	var postElements = getChildrenByTagClass( document.documentElement, null, PM_POST_CLASS, null, _skipPostContent );
	if ( 1 != postElements.length )
		return;
	var post = getPostMicro( postElements[ 0 ] );
	var content = post.getContentElement( );

	if ( -1 == url.indexOf( '#' ) )
		return null;
	var path = url.substring( url.indexOf( '#' ) + 1 );
	var node = PathToNode( content, path );
	return node;
}

function scrollWindowToNode( node )
{
	if ( null != node )
	{
		var xoffset = getWindowXScroll( );
		var yoffset = getElementYOffset( node, node.ownerDocument.documentElement );
		window.scrollTo( xoffset, yoffset );
	}
}

 
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


/* ************************ Add/Show Functions ************************ */
/* These are for adding an annotation to the post and display.
 * addAnnotation calls the other three in order:
 * showNote, highlightRange, positionNote
 * None of these do anything with the server, but they do create interface
 * elements which when activated call server functions.
 *
 * In order to achieve a single point of truth, the only annotation list
 * is the list of annotation notes attached to each post in the DOM.
 * On the one hand, the two can't vary independently.  But I can't think
 * why they would need to.  This way, they can't get out of sync.
 */

/**
 * Get the index where an annotation is or where it would display
 */
PostMicro.prototype.getAnnotationIndex = function( marginalia, annotation )
{
	var notesElement = this.getNotesElement( marginalia );
	// Go from last to first, on the assumption that this function will be called repeatedly
	// in order.  Calling in reverse order gives worst-case scenario O(n^2) behavior.
	// Don't forget the first node in the list is a dummy with no annotation.
	var pos = notesElement.childNodes.length;
	for ( var note = notesElement.lastChild;  null != note;  note = note.previousSibling )
	{
		--pos;
		if ( null != note.annotation )
		{
			if ( note.annotation.id == annotation.id )
				break;
			else if ( compareAnnotationRanges( note.annotation, annotation ) < 0 )
				break;
		}
	}
	return pos;
}

/**
 * Add an annotation to the local annotation list and display at
 * a given position in the annotation list.  This position must
 * be correct;  passing it makes this faster than addAnnotation().
 */
PostMicro.prototype.addAnnotationPos = function( marginalia, annotation, pos )
{
	if ( ! this.showHighlight( marginalia, annotation ) )
		return -1;
	this.showNote( marginalia, pos, annotation );
	return pos;
}

/**
 * Add an annotation to the local annotation list and display.
 */
PostMicro.prototype.addAnnotation = function( marginalia, annotation )
{
	var pos = this.getAnnotationIndex( marginalia, annotation );
	return this.addAnnotationPos( marginalia, annotation, pos );
}

/**
 * Create an item in the notes list
 * pos - the position in the list
 * annotation - the annotation
 */
PostMicro.prototype.showNote = function( marginalia, pos, annotation )
{
	var noteList = this.getNotesElement( marginalia );

	// Ensure we have a dummy first sibling
	if ( null == noteList.firstChild )
	{
		var dummy = document.createElement( 'li' );
		dummy.setAttribute( 'class', AN_DUMMY_CLASS );
		dummy.className = AN_DUMMY_CLASS;
		noteList.appendChild( dummy );
	}
	
	// Find the notes that will precede and follow this one
	var prevNode = noteList.firstChild; // the dummy first node
	var nextNode = noteList.firstChild.nextSibling; // skip dummy first node
	for ( var j = 0;  j < pos && null != nextNode;  ++j )
	{
		prevNode = nextNode;
		nextNode = nextNode.nextSibling;
	}

	// Create the list item
	var postMicro = this;
	var noteElement = document.createElement( 'li' );
	noteElement.id = AN_ID_PREFIX + annotation.id;
	noteElement.annotationId = annotation.id;
	noteElement.annotation = annotation;
	
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
		
		var controlId = AN_ID_PREFIX + annotation.id + '-linkedit';
		
		// add the link label
		var labelNode = document.createElement( 'label' );
		labelNode.setAttribute( 'title', getLocalized( 'annotation link label' ) );
		labelNode.appendChild( document.createTextNode( AN_LINKEDIT_LABEL ) );
		labelNode.setAttribute( 'for', controlId );
		noteElement.appendChild( labelNode );

		// Add the URL input field
		var editNode = document.createElement( 'input' );
		editNode.setAttribute( 'id', controlId );
		editNode.setAttribute( 'value', annotation.link ? annotation.link : '' );
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
		buttonNode.annotationId = annotation.id;
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
		var canEdit = null != marginalia.username && annotation.userid == marginalia.username;
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
				buttonNode.setAttribute( 'href', annotation.link );
				buttonNode.onclick = _editLink;
				controls.appendChild( buttonNode );
			}

			if ( ANNOTATION_ACCESS || annotation.access != ANNOTATION_ACCESS_DEFAULT )
			{
				// add the access button
				// even if the feature is turned off, show this if the access is not
				// what's expected - this is a subtle way of at least letting users
				// know something may be amiss
				buttonNode = document.createElement( "button" );
				buttonNode.setAttribute( 'type', "button" );
				buttonNode.className = AN_ACCESSBUTTON_CLASS;
				buttonNode.setAttribute( 'title', annotation.access == AN_PUBLIC_ACCESS ?
					getLocalized( 'public annotation' ) : getLocalized( 'private annotation' ) );
				buttonNode.appendChild( document.createTextNode( annotation.access == AN_PUBLIC_ACCESS ? AN_SUN_SYMBOL : AN_MOON_SYMBOL ) );
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
			buttonNode.annotationId = annotation.id;
			buttonNode.onclick = _deleteAnnotation;
			controls.appendChild( buttonNode );
		}
		
		// add the text content
		var noteText = document.createElement( 'p' );
		var keyword = marginalia.keywordService.getKeyword( annotation.note );
		if ( keyword )
			noteText.setAttribute( 'title', keyword.description );
		noteText.appendChild( document.createTextNode( annotation.note ) );
		noteElement.appendChild( noteText );
		
		if ( canEdit )
		{
			// Add edit behavior
			noteText.onclick = _editAnnotation;
		}
		
		// Add note hover behaviors
		noteElement.onmouseover = _hoverAnnotation;
		noteElement.onmouseout = _unhoverAnnotation;
	}

	var highlightElement = getChildByTagClass( this.contentElement, 'em', AN_ID_PREFIX + annotation.id, null );
	noteElement.style.marginTop = '' + this.calculateNotePushdown( marginalia, prevNode, highlightElement ) + 'px';
	
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
			var value = annotation.note;
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
			if ( ! marginalia.keywordService.isKeyword( annotation.note ) && annotation.note )
			{
				// First option is the freeform edit value for the note
				var opt = document.createElement( 'option' );
				opt.appendChild( document.createTextNode(
					annotation.note.length > 12 ? annotation.note.substring( 0, 12 ) : annotation.note ) );
				opt.setAttribute( 'value', annotation.note );
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
		var value = annotation.note;
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
			editNode.annotationId = annotation.id;
			editNode.onkeypress = _editNoteKeypress;
			editNode.onkeyup = _editChangedKeyup;
		}
		return editNode;
	}
}

 
/**
 * Display a single highlighted range
 * Inserts em tags of class annotation were appropriate
 */
PostMicro.prototype.showHighlight = function( marginalia, annotation )
{
	if ( annotation.xpathRange )
		trace( 'show-highlight', 'Show highlight for annotation at xpath ' + annotation.xpathRange.toString( ) + ': ' + annotation.quote );
	else
		trace( 'show-highlight', 'Show highlight for annotation at block ' + annotation.blockRange.toString( ) + ': ' + annotation.quote );
		
	// Word range needed for conversion to text range and for later calculations
	var wordRange = new WordRange( );
	if ( annotation.xpathRange )
	{
		var r = wordRange.fromXPathRange( annotation.xpathRange, this.contentElement, _skipContent );
		if ( false == r )
		{
			// trace( 'find-quote', 'Annotation ' + annotation.id + ' not within the content area.' );
			return false;
		}
	}
	else
	{
		if ( ! wordRange.fromBlockRange( annotation.blockRange, this.contentElement, _skipContent ) )
		{
			trace( 'find-quote', 'Annotation ' + annotation.id + ' not within the content area.' );
			return false;
		}
		// TODO: Store XPathRange back to annotation on server
	}
	
	// Text range is easiest way to get textual content of annotation
	// TODO: This calculation is effectively done twice - once, here, to fetch the text, and once
	// below to determine highlight regions.
	var textRange = new TextRange( );
	textRange.fromWordRange( wordRange, _skipContent );
	// Check whether the content of the text range matches what the annotation expects
	if ( null == textRange )
	{
		trace( 'find-quote', 'Annotation ' + annotation.id + ' not within the content area.' );
		return false;
	}
	var actual = getTextRangeContent( textRange, _skipContent );
	var quote = annotation.quote;
	actual = actual.replace( /\s|\u00a0\s*/g, ' ' );
	quote = quote.replace( /\s|\u00a0\s*/g, ' ' );
	if ( actual != quote )
	{
		var contextBefore = '';
		var contextAfter = '';
		var tempRange;
		if ( textRange.startOffset > 0 )
		{
			tempRange = new TextRange( textRange.startContainer, textRange.startOffset >= 15 ? textRange.startOffset : 0, textRange.startContainer, textRange.startOffset );
			contextBefore = getTextRangeContent( tempRange, _skipContent );
			tempRange.destroy( );
			tempRange = null;
		}
		var endLength = nodeTextLength( textRange.endContainer );
		if ( textRange.endOffset < endLength )
		{
			tempRange = new TextRange( textRange.endContainer, textRange.endOffset, textRange.endContainer, textRange.endOffset + 15 < endLength ? textRange.endOffset + 15 : endLength );
			contextAfter = getTextRangeContent( tempRange, _skipContent );
			tempRange.destroy( );
			tempRange = null;
		}
		var rangeStr = annotation.blockRange ? annotation.blockRange.toString() : '';
		trace( 'find-quote', 'Annotation ' + annotation.id + ' range (' + rangeStr + ') \"' + contextBefore + '<' + actual + '>' + contextAfter + '\" doesn\'t match "' + quote + '"' );
		return false;
	}
	else
		trace( 'find-quote', 'Quote found: ' + actual + ' (' + textRange.startOffset + ',' + textRange.endOffset + ')' );
	
	//setTrace( 'WordPointWalker', true );		// Show return values from WordPointWalker
	var walker = new WordPointWalker( wordRange.start.rel, _skipContent );
	walker.walkToPoint( wordRange.start );
	var initialOffset = walker.currChars;
	var initialRel = walker.currNode;

	var highlightRanges = new Array();
	walker.setPoint( wordRange.end );
	var rangeNum = 0;
	var done = false;
	while ( ! done )
	{
		done = walker.walk( );
		if ( 0 == rangeNum )
		{
			highlightRanges[ rangeNum ] = new TextRange( 
				walker.currNode, initialOffset,
				walker.currNode, walker.currChars );
		}
		else
		{
			highlightRanges[ rangeNum ] = new TextRange(
				walker.currNode, 0,
				walker.currNode, walker.currChars );
		}
		trace( 'show-highlight', 'HRange: ' + highlightRanges[ rangeNum ].startOffset + ' ' 
			+ highlightRanges[ rangeNum ].endOffset + " [" + walker.currNode + "]\n" ); //+ getNodeText( walker.currNode ) );
		rangeNum += 1;
	}
	walker.destroy();
//setTrace( 'WordPointWalker', false );		// Show return values from WordPointWalker
	
	// Now iterate over the ranges and highlight each one
	var lastHighlight = null;  // stores the last highlighted area
	for ( var i = 0;  i < highlightRanges.length;  ++i )
	{
		var range = highlightRanges[ i ];
		var node = range.startContainer;
		
		//trace( 'show-highlight', 'Range ' + String(i) + ': ' + range.startContainer.nodeValue.substr(0,40) );

		// Is <em> valid in this position in the document?  (It might well not be if
		// this is a script or style element, or if this is whitespace text in
		// certain other nodes (ul, ol, table, tr, etc.))
		if ( isValidHtmlContent( node.parentNode.tagName, 'em' ) )
		{
			var newNode;
			var text = node.nodeValue + "";
			// break the portion of the node before the annotation off and insert it
			if ( range.startOffset > 0 )
			{
				newNode = document.createTextNode( text.substring( 0, range.startOffset ) );
				node.parentNode.insertBefore( newNode, node );
			}
			// replace node content with annotation
			newNode = document.createElement( 'em' );
			newNode.className = AN_HIGHLIGHT_CLASS + ' ' + AN_ID_PREFIX + annotation.id;
			newNode.onmouseover = _hoverAnnotation;
			newNode.onmouseout = _unhoverAnnotation;
			newNode.annotation = annotation;
			node.parentNode.replaceChild( newNode, node );
			newNode.appendChild( node );
			node.nodeValue = text.substring( range.startOffset, range.endOffset );
			lastHighlight = newNode;
			node = newNode;	// necessary for the next bit to work right
			// break the portion of the node after the annotation off and insert it
			if ( range.endOffset < text.length )
			{
				newNode = document.createTextNode( text.substring( range.endOffset ) );
				if ( node.nextSibling )
					node.parentNode.insertBefore( newNode, node.nextSibling );
				else
					node.parentNode.appendChild( newNode );
			}
		}
	}
	
	if ( lastHighlight )
	{
		addClass( lastHighlight, AN_LASTHIGHLIGHT_CLASS );
		// If there's a link from this annotation, add the link icon
		if ( ANNOTATION_LINKING && annotation.link )
			this.showLink( marginalia, annotation );
	}
	return true;
}

/**
 * Display a link icon for an annotation link
 * Requires that the highlighting for the annotation already be displayed
 * (this is how it figures out just where to put the link icon)
 */
PostMicro.prototype.showLink = function( marginalia, annotation )
{
	var existingLink = getChildByTagClass( this.contentElement, 'a', AN_ID_PREFIX + annotation.id, _skipContent );
	if ( existingLink )
		existingLink.parentNode.removeChild( existingLink );
	
	if ( null != annotation.link && '' != annotation.link )
	{
		var highlights = getChildrenByTagClass( this.contentElement, 'em', AN_ID_PREFIX + annotation.id, null, _skipContent );
		for ( var i = 0;  i < highlights.length;  ++i )
		{
			if ( hasClass( highlights[ i ], AN_LASTHIGHLIGHT_CLASS ) )
			{
				// should check whether a link is valid in this location;  if not,
				// either refuse to show or insert a clickable Javascript object instead
				var lastHighlight = highlights[ i ];
				var supNode = document.createElement( 'sup' );
				var linkNode = document.createElement( 'a' );
				linkNode.setAttribute( 'href', annotation.link );
				
				if ( null != annotation.note && '' != annotation.note )
				{
					var keyword = marginalia.keywordService.getKeyword( annotation.note );
					if ( keyword )
						linkNode.setAttribute( 'title', keyword.name + ': ' + keyword.description );
					else
					{
						linkNode.setAttribute( 'title',
							annotation.note.length > MAX_NOTEHOVER_LENGTH
							? annotation.note.substr( 0, MAX_NOTEHOVER_LENGTH ) + '...'
							: annotation.note );
					}
				}
				
				linkNode.appendChild( document.createTextNode( AN_LINK_ICON ) );
				supNode.appendChild( linkNode );
				lastHighlight.appendChild( supNode );
				addClass( linkNode, AN_LINK_CLASS + ' ' + AN_ID_PREFIX + annotation.id );
			}
		}
	}
}

/*
 * Position the notes for an annotation next to the highlight
 * It is not necessary to call this method when creating notes, only when the positions of
 * existing notes are changing
 */
PostMicro.prototype.positionNote = function( marginalia, annotation )
{
	var note = document.getElementById( AN_ID_PREFIX + annotation.id );
	while ( null != note )
	{
		var highlight = getChildByTagClass( this.contentElement, 'em', AN_ID_PREFIX + annotation.id, null );
		if ( null == highlight || null == note )
			logError( "positionNote:  Couldn't find note or highlight for " + AN_ID_PREFIX + annotation.id );
		else
			note.style.marginTop = '' + this.calculateNotePushdown( note.previousSibling, highlight );
		note = note.nextSibling;
	}
}

/*
 * Calculate the pixel offset from the previous displayed note to this one
 * by setting the top margin to the appropriate number of pixels.
 * The previous note and the highlight must already be displayed, but this note
 * does not yet need to be part of the DOM.
 */
PostMicro.prototype.calculateNotePushdown = function( marginalia, previousNoteElement, highlightElement )
{
	var noteY = getElementYOffset( previousNoteElement, null ) + previousNoteElement.offsetHeight;
	var highlightY = getElementYOffset( highlightElement, null );
	// highlightElement.border = 'red 1px solid';
	trace( 'align-notes', 'calculateNotePushdown for ' + getNodeText( highlightElement ) + ' (' + highlightElement.className + ') : highlightY=' + highlightY + ', noteY=' + noteY );
	return ( noteY < highlightY ) ? highlightY - noteY : 0;
}

/*
 * Reposition notes, starting with the note list element passed in
 */
PostMicro.prototype.repositionNotes = function( marginalia, element )
{
	// We don't want the browser to scroll, which it might under some circumstances
	// (I believe it's a timing thing)
	for ( ;  null != element;  element = element.nextSibling )
	{
		var highlightElement = getChildByTagClass( this.contentElement, null, AN_ID_PREFIX + element.annotation.id, null );
		element.style.marginTop = '' + this.calculateNotePushdown( marginalia, element.previousSibling, highlightElement ) + 'px';
	}
}


/**
 * Get all annotations on a post by looking at HTML (no check with server)
 */
PostMicro.prototype.listAnnotations = function( marginalia )
{
	var notesElement = this.getNotesElement( marginalia );
	var child = notesElement.firstChild;
	var annotations = new Array( );
	while ( null != child )
	{
		if ( child.annotation )
			annotations[ annotations.length ] = child.annotation;
		child = child.nextSibling;
	}
	return annotations;
}

/* ************************ Remove/Hide Functions ************************ */
/* These are counterparts to the add/show functions above */

/*
 * Remove all annotations from a post
 * Returns an array of removed annotations so the caller can destruct them if necessary
 */
PostMicro.prototype.removeAnnotations = function( marginalia )
{
	var notesElement = this.getNotesElement( marginalia );
	var child = notesElement.firstChild;
	var annotations = new Array( );
	while ( null != child )
	{
		if ( child.annotation )
		{
			annotations[ annotations.length ] = child.annotation;
			child.annotation = null;
		}
		notesElement.removeChild( child );
		child = notesElement.firstChild;
	}
	stripMarkup( this.contentElement, 'em', AN_HIGHLIGHT_CLASS, true );
	//portableNormalize( this.contentElement );
	removeClass( this.element, AN_ANNOTATED_CLASS );
	return annotations;
}

/**
 * Remove an individual annotation from a post
 */
PostMicro.prototype.removeAnnotation = function ( marginalia, annotation )
{
	var next = this.removeNote( marginalia, annotation );
	this.removeHighlight( marginalia, annotation );
	return null == next ? null : next.annotation;
}

/**
 * Remove an note from the displayed list
 * Returns the next list item in the list
 */
PostMicro.prototype.removeNote = function( marginalia, annotation )
{
	var listItem = document.getElementById( AN_ID_PREFIX + annotation.id );
	var next = listItem.nextSibling;
	listItem.parentNode.removeChild( listItem );
	listItem.annotation = null; // dummy item won't have this field
	clearEventHandlers( listItem, true );	
	return next;
}

/**
 * Recursively remove highlight markup
 */
PostMicro.prototype.removeHighlight = function ( marginalia, annotation )
{
	var contentElement = this.contentElement;
	var highlights = getChildrenByTagClass( contentElement, 'em', AN_ID_PREFIX + annotation.id, null, null );
	for ( var i = 0;  i < highlights.length;  ++i )
		highlights[ i ].annotation = null;
	stripMarkup( contentElement, 'em', AN_ID_PREFIX + annotation.id, true, stripLinks );
	// This normalization was (erroneously) commented out - I think because it's so slow.
	// The best solution would be to a) modify stripMarkup to join adjacent text elements
	// as it goes, or b) write a walker to join relevant text elements.
	// Frankly, it seems fast enough to me.  Perhaps I removed it while making necessary
	// removals elsewhere, or perhaps my short document isn't a sufficient speed test.
	portableNormalize( contentElement );
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

/* ************************ Display Actions ************************ */
/* These are called by event handlers.  Unlike the handlers, they are
 * not specific to controls or events (they should make no assumptions
 * about the event that triggered them). */

/**
 * Indicate an annotation is under the mouse cursor by lighting up the note and the highlight
 * If flag is false, this will remove the lit-up indication instead.
 */
PostMicro.prototype.hoverAnnotation = function( marginalia, annotation, flag )
{
	// Activate the note
	var noteNode = document.getElementById( AN_ID_PREFIX + annotation.id );
	if ( flag )
		addClass( noteNode, AN_HOVER_CLASS );
	else
		removeClass( noteNode, AN_HOVER_CLASS );

	// Activate the highlighted areas
	var highlights = getChildrenByTagClass( this.contentElement, null, AN_HIGHLIGHT_CLASS, null, null );
	for ( var i = 0;  i < highlights.length;  ++i )
	{
		var node = highlights[ i ];
		// Need to change to upper case in case this is HTML rather than XHTML
		if ( node.tagName.toUpperCase( ) == 'EM' && node.annotation == annotation )
		{
			if ( flag )
				addClass( node, AN_HOVER_CLASS );
			else
				removeClass( node, AN_HOVER_CLASS );
		}
	}
}

/*
 * Called to start editing a new annotation
 * the annotation isn't saved to the db until edit completes
 */
PostMicro.prototype.createAnnotation = function( marginalia, annotation )
{
	// Ensure the window doesn't scroll by saving and restoring scroll position
	var scrollY = getWindowYScroll( );
	var scrollX = getWindowXScroll( );

	annotation.isLocal = true;
	annotation.editing = annotation.defaultNoteEditMode( marginalia.preferences );
	
	// Show the annotation and highlight
	this.addAnnotation( marginalia, annotation );
	// Focus on the text edit
	var noteElement = document.getElementById( AN_ID_PREFIX + annotation.id );
	var editElement = ( AN_EDIT_NOTE_KEYWORDS == annotation.editing )
		? getChildByTagClass( noteElement, 'select', null, null )
		: getChildByTagClass( noteElement, 'textarea', null, null );
	// Sequencing here (with focus last) is important
	this.repositionNotes( marginalia, noteElement.nextSibling );
	editElement.focus( );
	// Just in case - IE can't get it right when editing, so I don't trust it
	// on create either, even if it does work for me.
	if ( 'exploder' == detectBrowser( ) )
		editElement.focus( );
	
	window.scrollTo( scrollX, scrollY );
}


/**
 * Save an annotation after editing
 */
PostMicro.prototype.saveAnnotation = function( marginalia, annotation )
{
	// Remove events
	removeAnonBubbleEventListener( document.documentElement, 'click', _saveAnnotation );
	var noteElement = document.getElementById( AN_ID_PREFIX + annotation.id );
	removeAnonBubbleEventListener( noteElement, 'click', stopPropagation );
	
	marginalia.preferences.setPreference( PREF_NOTEEDIT_MODE, annotation.editing );
	
	// Ensure the window doesn't scroll by saving and restoring scroll position
	var scrollY = getWindowYScroll( );
	var scrollX = getWindowXScroll( );
	
	var listItem = document.getElementById( AN_ID_PREFIX + annotation.id );
	
	var noteStr = annotation.note;
	if ( AN_EDIT_NOTE_KEYWORDS == annotation.editing )
	{
		var selectNode = getChildByTagClass( listItem, 'select', AN_KEYWORDSCONTROL_CLASS, null );
		if ( selectNode.selectedIndex > -1 )
			noteStr = selectNode.options[ selectNode.selectedIndex ].value;
	}
	else
	{
		var editNode = getChildByTagClass( listItem, 'textarea', null, null );
		
		// Check the length of the note.  If it's too long, do nothing, but restore focus to the note
		// (which is awkward, but we can't save a note that's too long, we can't allow the note
		// to appear saved, and truncating it automatically strikes me as an even worse solution.) 
		if ( editNode.value.length > MAX_NOTE_LENGTH )
		{
			alert( getLocalized( 'note too long' ) );
			editNode.focus( );
			return false;
		}
		noteStr = editNode.value;
	}
	
	// don't allow this to happen more than once
	if ( ! annotation.editing )
		return false;
	this.hoverAnnotation( marginalia, annotation, false );
	delete annotation.editing;
	annotation.note = noteStr;

	// Update the link hover (if present)
	this.showLink( marginalia, annotation );
	
	// Replace the editable note display
	this.removeNote( marginalia, annotation );
	noteElement = this.showNote( marginalia, this.getAnnotationIndex( marginalia, annotation ), annotation );
	this.repositionNotes( marginalia, noteElement.nextSibling );
	
	removeClass( getBodyElement( document ), AN_EDITINGNOTE_CLASS );
	
	// The annotation is local and needs to be created in the DB
	if ( annotation.isLocal )
	{
		var postMicro = this;
		var f = function( url ) {
			// update the annotation with the created ID
			var id = url.substring( url.lastIndexOf( '/' ) + 1 );
			annotation.id = id;
			annotation.isLocal = false;
			var noteElement = document.getElementById( AN_ID_PREFIX + '0' );
			noteElement.id = AN_ID_PREFIX + annotation.id;
			var highlightElements = getChildrenByTagClass( postMicro.contentElement, 'em', AN_ID_PREFIX + '0', null, null );
			for ( var i = 0;  i < highlightElements.length;  ++i )
			{
				removeClass( highlightElements[ i ], AN_ID_PREFIX + '0' );
				addClass( highlightElements[ i ], AN_ID_PREFIX + annotation.id );
			}
		};
		annotation.url = this.url;
		
		// IE may have made a relative URL absolute, which could cause problems
		if ( null != marginalia.urlBase
			&& annotation.url.substring( 0, marginalia.urlBase.length ) == marginalia.UrlBase )
		{
			annotation.url = annotation.url.substring( marginalia.urlBase.length );
		}

		annotation.note = noteStr;
		annotation.title = this.title;
		annotation.author = this.author;
		marginalia.createAnnotation( annotation, f );
	}
	// The annotation already exists and needs to be updated
	else
	{
		annotation.note = noteStr;
		marginalia.updateAnnotation( annotation, null );
	}
	
	window.scrollTo( scrollX, scrollY );
	return true;
}

/**
 * Delete an annotation
 */
PostMicro.prototype.deleteAnnotation = function( marginalia, annotation )
{
	// Ensure the window doesn't scroll by saving and restoring scroll position
	var scrollY = getWindowYScroll( );
	var scrollX = getWindowXScroll( );

	// Delete it on the server
	marginalia.deleteAnnotation( annotation.id, null );
	
	// Find the annotation
	var next = this.removeAnnotation( marginalia, annotation );
	if ( null != next )
	{
		var nextElement = document.getElementById( AN_ID_PREFIX + next.id );
		this.repositionNotes( marginalia, nextElement );
	}
	annotation.destruct( );
	
	window.scrollTo( scrollX, scrollY );
}


/**
 * Edit an annotation link.  This displays a URL box, and activates the
 * ability to click on block-level elements to link to them.
 */
PostMicro.prototype.editAnnotationLink = function( marginalia, annotation )
{
	annotation.editing = AN_EDIT_LINK;
	this.removeNote( marginalia, annotation );
	var noteElement = this.showNote( marginalia, this.getAnnotationIndex( marginalia, annotation ), annotation );
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
	var noteElement = document.getElementById( AN_ID_PREFIX + annotation.id );
	removeAnonBubbleEventListener( noteElement, 'click', stopPropagation );

	// don't allow this to happen more than once
	if ( ! annotation.editing )
		return false;

	// Ensure the window doesn't scroll by saving and restoring scroll position
	var scrollY = getWindowYScroll( );
	var scrollX = getWindowXScroll( );
	
	var listItem = document.getElementById( AN_ID_PREFIX + annotation.id );	
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
	annotation.link = editNode.value;
	marginalia.updateAnnotation( annotation, null );

	// Update the link display
	this.showLink( marginalia, annotation );
	
	// Replace the editable note display
	this.removeNote( marginalia, annotation );
	var noteElement = this.showNote( marginalia, this.getAnnotationIndex( marginalia, annotation ), annotation );
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
	this.removeNote( marginalia, annotation );
	var noteElement = this.showNote( marginalia, this.getAnnotationIndex( marginalia, annotation ), annotation );
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
	marginalia.updateAnnotation( marginalia, annotation.id, null );
	
	this.showLink( marginalia, annotation );
	
	window.scrollTo( scrollX, scrollY );
}



/* ************************ Event Handlers ************************ */
/* Each of these should capture an event, obtain the necessary information
 * to execute it, and dispatch it to something else to do the work */

/**
 * Mouse hovers over an annotation note or highlight
 */
function _hoverAnnotation( event )
{
	var post = getNestedFieldValue( this, AN_POST_FIELD );
	var annotation = getNestedFieldValue( this, AN_ANNOTATION_FIELD );
	post.hoverAnnotation( window.marginalia, annotation, true );
}

/**
 * Mouse hovers off an annotation note or highlight
 */
function _unhoverAnnotation( event )
{
	// IE doesn't have a source node for the event, so use this
	var post = getNestedFieldValue( this, AN_POST_FIELD );
	var annotation = getNestedFieldValue( this, AN_ANNOTATION_FIELD );
	post.hoverAnnotation( window.marginalia, annotation, false );
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
		var next = post.removeNote( marginalia, annotation );
		var noteElement = post.showNote( marginalia, post.getAnnotationIndex( marginalia, annotation ), annotation );
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
	var annotationNode = document.getElementById( AN_ID_PREFIX + annotation.id );
	var editNode = getChildByTagClass( annotationNode, 'input', null, null );
	editNode.value = '';
	post.saveAnnotationLink( window.marginalia, annotation );
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
			annotation.note = editNode.value.substr( 0, MAX_NOTE_LENGTH );
		else
			annotation.note = editNode.value;
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

	annotation.access = annotation.access == 'public' ? 'private' : 'public';
	window.marginalia.updateAnnotation( annotation, null );
	while ( accessButton.firstChild )
		accessButton.removeChild( accessButton.firstChild );
	accessButton.appendChild( document.createTextNode( annotation.access == 'public' ? AN_SUN_SYMBOL : AN_MOON_SYMBOL ) );
	accessButton.setAttribute( 'title', annotation.access == 'public' ?
		getLocalized( 'public annotation' ) : getLocalized( 'private annotation' ) );
}

/**
 * Hit any key in document
 */
function _keyupCreateAnnotation( event )
{
	var marginalia = window.marginalia;
	event = getEvent( event );
	if ( event.keyCode == 13 )
	{
		if ( null != marginalia.username && marginalia.username == marginalia.anusername )
		{
			if ( createAnnotation( null, false ) )
				stopPropagation( event );
		}
	}
}

/**
 * Skip embedded links created by annotation
 */
function _skipAnnotationLinks( node )
{
	return ELEMENT_NODE == node.nodeType 
		&& node.parentNode
		&& hasClass( node.parentNode, AN_HIGHLIGHT_CLASS );
}


/**
 * Create a highlight range based on user selection
 * This is not in the event handler section above because it's up to the calling
 * application to decide what control creates an annotation.  Deletes and edits,
 * on the other hand, are built-in to the note display.
 */
function createAnnotation( postId, warn )
{
	// Test for selection support (W3C or IE)
	if ( ( ! window.getSelection || null == window.getSelection().rangeCount )
		&& null == document.selection )
	{
		if ( warn )
			alert( getLocalized( 'browser support of W3C range required for annotation creation' ) );
		return false;
	}
		
	var textRange = getPortableSelectionRange();
	if ( null == textRange )
	{
		if ( warn )
			alert( getLocalized( 'select text to annotate' ) );
		return false;
	}
	
	// Check for an annotation with id 0.  If one exists, we can't send another request
	// because the code would get confused by the two ID values coming back.  In that
	// case (hopefully very rare), silently fail.  (I figure the user doesn't want to
	// see an alert pop up, and the natural human instinct would be to try again).
	if ( null != document.getElementById( AN_ID_PREFIX + '0' ) )
		return;
	
	if ( null == postId )
	{
		var contentElement = getParentByTagClass( range.startContainer, null, PM_CONTENT_CLASS, false, null );
		if ( null == contentElement )
			return false;
		postId = getParentByTagClass( contentElement, null, PM_POST_CLASS, true, _skipPostContent ).id;
	}
	
	var marginalia = window.marginalia;
	var post = document.getElementById( postId ).post;
	var annotation = new Annotation( post.url );
	annotation.userid = marginalia.username;
	var wordRange = new WordRange( );
	wordRange.fromTextRange( textRange, post.contentElement, _skipContent );
	annotation.blockRange = wordRange.toBlockRange( post.contentElement );
	annotation.xpathRange = wordRange.toXPathRange( post.contentElement );
	
	// TODO: test selection properly
	if ( null == annotation )
	{
		if ( warn )
			alert( getLocalized( 'invalid selection' ) );
		return false;
	}
	
	annotation.quote = getTextRangeContent( textRange, _skipContent );
	if ( 0 == annotation.quote.length )
	{
		annotation.destruct( );
		if ( warn )
			alert( getLocalized( 'zero length quote' ) );
		trace( null, "zero length quote '" + annotation.quote + "'" );
		return false;
	}
	
	// Check to see whether the quote is too long (don't do this based on the raw text 
	// range because the quote strips leading and trailing spaces)
	if ( annotation.quote.length > MAX_QUOTE_LENGTH )
	{
		annotation.destruct( );
		if ( warn )
			alert( getLocalized( 'quote too long' ) );
		return false;
	}
	
	post.createAnnotation( marginalia, annotation );
	return true;
}
