/*
 * track-changes.js
 *
 * Track change support for those that need it.  If your app doesn't need this
 * feature, don't include it.
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
						postMicro.showNoteEditor( marginalia, annotation, marginalia.getEditor(), noteElement );
					}
				} )	
			} ),
			domutil.element( 'li', {
				content: domutil.element( 'button', {
					content: getLocalized( 'action insert before button' ),
					onclick: function( event ) {
						annotation.makeInsertBefore();
						postMicro.showNoteEditor( marginalia, annotation, marginalia.getEditor(), noteElement );
					}
				} )	
			} ),
			domutil.element( 'li', {
				content: domutil.element( 'button', {
					content: getLocalized( 'action insert after button' ),
					onclick: function( event ) {
						annotation.makeInsertAfter( );
						postMicro.showNoteEditor( marginalia, annotation, marginalia.getEditor(), noteElement );
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
						postMicro.showNoteEditor( marginalia, annotation, marginalia.getEditor(), noteElement );
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
