Annotation.prototype.makeInsertBefore = function( )
{
	this.setAction( 'edit' );
	this.getRange( SEQUENCE_RANGE ).collapseToStart( );
	this.getRange( XPATH_RANGE ).collapseToStart( );
	this.setQuote( '' );
}

Annotation.prototype.makeInsertAfter = function( )
{
	this.setAction( 'edit' );
	this.getRange( SEQUENCE_RANGE ).collapseToEnd( );
	this.getRange( XPATH_RANGE ).collapseToEnd( );
	this.setQuote( '' );
}


/**
 * Editor for selecting action type before proceding to actual editor
 */
function SelectActionNoteEditor( )
{ }

SelectActionNoteEditor.prototype.clear = function( )
{
	while ( this.noteElement.firstChild )
	{
		if ( this.noteElement.onclick )
			this.noteElement.onclick = null;
		this.noteElement.removeChild( this.noteElement.firstChild );
	}
}

SelectActionNoteEditor.prototype.show = function( )
{
	var postMicro = this.postMicro;
	var marginalia = this.marginalia;
	var annotation = this.annotation;
	var noteElement = this.noteElement;

	var ul = this.noteElement.appendChild( domutil.element( 'ul', {
		className: 'select-action',
		content: [
			domutil.element( 'li', {
				content: domutil.element( 'button', {
					content: getLocalized( 'action annotate button' ),
					onclick: function( event ) {
						postMicro.showNoteEditor( marginalia, annotation, new FreeformNoteEditor( ), noteElement );
						marginalia.noteEditor.focus( );
					}
				} )	
			} ),
			domutil.element( 'li', {
				content: domutil.element( 'button', {
					content: getLocalized( 'action insert before button' ),
					onclick: function( event ) {
						annotation.makeInsertBefore();
						postMicro.showNoteEditor( marginalia, annotation, new FreeformNoteEditor( ), noteElement );
						marginalia.noteEditor.focus( );
					}
				} )	
			} ),
			domutil.element( 'li', {
				content: domutil.element( 'button', {
					content: getLocalized( 'action insert after button' ),
					onclick: function( event ) {
						annotation.makeInsertAfter( );
						postMicro.showNoteEditor( marginalia, annotation, new FreeformNoteEditor( ), noteElement );
						marginalia.noteEditor.focus( );
					}
				} )	
			} ),
			domutil.element( 'li', {
				content: domutil.element( 'button', {
					content: getLocalized( 'action replace button' ),
					onclick: function( event ) {
						annotation.setAction( 'edit' );
						postMicro.removeHighlight( marginalia, annotation );
						postMicro.showHighlight( marginalia, annotation );
						postMicro.showNoteEditor( marginalia, annotation, new FreeformNoteEditor( ), noteElement );
						marginalia.noteEditor.focus( );
					}
				} )	
			} ),
			domutil.element( 'li', {
				content: domutil.element( 'button', {
					content: getLocalized( 'action delete button' ),
					onclick: function( event ) {
						annotation.setAction( 'edit' );
						postMicro.removeHighlight( marginalia, annotation );
						postMicro.showHighlight( marginalia, annotation );
						_saveAnnotation( );
					}
				} )	
			} )
		] } ) ) ;
}

SelectActionNoteEditor.prototype.focus = function( )
{ }

function addEditShortcuts( )
{
	// Insert before
	shortcut.add( 'a', function( ) {
		createAnnotation(null, false, new DummyNoteEditor( function( e ) {
			e.annotation.makeInsertBefore( );
			e.postMicro.showNoteEditor( e.marginalia, e.noteElement, new FreeformNoteEditor( ) );
			e.marginalia.noteEditor.focus( );
		}));
	});
	
	// Insert after
	shortcut.add( 'z', function( ) {
		createAnnotation(null, false, new DummyNoteEditor( function( e ) {
			e.annotation.makeInsertAfter( );
			e.postMicro.showNoteEditor( e.marginalia, e.noteElement, new FreeformNoteEditor( ) );
			e.marginalia.noteEditor.focus( );
		}));
	});
	
	// Replace
	shortcut.add( 'r', function( ) {
		createAnnotation(null, false, new DummyNoteEditor( function( e ) {
			annotation.setAction( 'edit' );
			postMicro.removeHighlight( marginalia, annotation );
			postMicro.showHighlight( marginalia, annotation );
			postMicro.showNoteEditor( marginalia, noteElement, new FreeformNoteEditor( ) );
			marginalia.noteEditor.focus( );
		}));
	});
	
	// Delete
	shortcut.add( 'x', function( ) {
		createAnnotation(null, false, new DummyNoteEditor( function( e ) {
			annotation.setAction( 'edit' );
			postMicro.removeHighlight( marginalia, annotation );
			postMicro.showHighlight( marginalia, annotation );
			_saveAnnotation( );
		}));
	});
}
