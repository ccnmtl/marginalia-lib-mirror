/*
 * post-micro.js
 *
 * Support for message / blog post micro-format.  This is based on the
 * hAtom microformat.
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

// These class names will change once there's a microformat standard.
PM_POST_CLASS = 'hentry';				// this is an addressable fragment for annotation
PM_CONTENT_CLASS = 'entry-content';	// the content portion of a fragment
PM_TITLE_CLASS = 'entry-title';		// the title of an annotated fragment
PM_AUTHOR_CLASS = 'author';			// the author of the fragment
PM_DATE_CLASS = 'published';			// the creation/modification date of the fragment
PM_URL_REL = 'bookmark';				// the url of this fragment (uses rel rather than class attribute)

/*
 * This class keeps track of PostMicro stuff on a page
 * Initially that information was integrated into individual DOM nodes (especially
 * as PostMicro objects), but because of memory leak problems I'm moving it here.
 */
function PostPageInfo( doc, baseUrl )
{
	this.baseUrl = baseUrl;
	this.posts = new Array( );
	this.postsById = new Object( );
	this.postsByUrl = new Object( );
	this.IndexPosts( doc.documentElement );
}

PostPageInfo.prototype.IndexPosts = function( root )
{
	var posts = domutil.childrenByTagClass( root, null, PM_POST_CLASS );
	for ( var i = 0;  i < posts.length;  ++i )
	{
		var postElement = posts[ i ];
		var post = new PostMicro( this, postElement );
		this.posts[ this.posts.length ] = post;
		if ( null != posts[ i ].id && '' != posts[ i ].id )
			this.postsById[ posts[ i ].id ] = post;
		if ( null != post.url && '' != post.url )
			this.postsByUrl[ post.url ] = post;
		postElement.post = post;
	}
}

PostPageInfo.prototype.getPostById = function( id )
{
	return this.postsById[ id ];
}

/*
 * Return a post with a matching URL or, if that does not exist, try stripping baseUrl off the passed Url
 */
PostPageInfo.prototype.getPostByUrl = function( url )
{
	if ( this.postsByUrl[ url ] )
		return this.postsByUrl[ url ];
	else if ( url.substring( 0, this.baseUrl.length ) == this.baseUrl )
		return this.postsByUrl( url.substring( this.baseUrl.length ) );
	else
		return null;
}

PostPageInfo.prototype.getAllPosts = function( )
{
	return this.posts;
}

/*
 * For ignoring post content when looking for specially tagged nodes, so that authors
 * of that content (i.e. users) can't mess things up.
 */
function _skipPostContent( node )
{
	return ( ELEMENT_NODE == node.nodeType && domutil.hasClass( node, PM_CONTENT_CLASS ) );
}


/*
 * Post Class
 * This is attached to the root DOM node of a post (not the document node, rather the node
 * with the appropriate class and ID for a post).  It stores references to child nodes
 * containing relevant metadata.  The class also provides a place to hang useful functions,
 * e.g. for annotation or smart copy support.
 */
function PostMicro( postInfo, element )
{
	// Point the post and DOM node to each other
	this.element = element;

	// The title
	var metadata = domutil.childByTagClass( element, null, PM_TITLE_CLASS, _skipPostContent );
	this.title = metadata == null ? '' : domutil.getNodeText( metadata );
	
	// The author
	metadata = domutil.childByTagClass( element, null, PM_AUTHOR_CLASS, _skipPostContent );
	this.author = metadata == null ? '' : domutil.getNodeText( metadata );
	
	// The date
	metadata = domutil.childByTagClass( element, 'abbr', PM_DATE_CLASS, _skipPostContent );
	if ( null == metadata )
		this.date = null;
	else
	{
		var s = metadata.getAttribute( 'title' );
		if ( null == s )
			this.date = null;
		else
		{
			var matches = s.match( /(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})[+-](\d{4})/ );
			if ( null == matches )
				this.date = null;
			else
				// I haven't figured out how to deal with the time zone, so it assumes that server
				// time and local time are the same - which is rather bad.
				this.date = new Date( matches[1], matches[2]-1, matches[3], matches[4], matches[5] );
		}
	}
	
	// The node containing the url
	metadata = domutil.childAnchor( element, PM_URL_REL, _skipPostContent );
	this.url = metadata.getAttribute( 'href' );
	if ( postInfo.baseUrl && this.url.substring( 0, postInfo.baseUrl.length ) == postInfo.baseUrl )
			this.url = this.url.substring( postInfo.baseUrl.length );
	
	// The node containing the content
	// Any offsets (e.g. as used by annotations) are from the start of this node's children
	this.contentElement = domutil.childByTagClass( this.element, null, PM_CONTENT_CLASS, _skipPostContent );

	return this;
}

/*
 * Accessor for related element
 * Used so that we can avoid storing a pointer to a DOM node,
 * which tends to cause memory leaks on IE.
 */
PostMicro.prototype.getElement = function( )
{
	return this.element;
}


/*
 * Accessor for content element
 * Used so that we can avoid storing a pointer to a DOM node,
 * which tends to cause memory leaks on IE.
 */
PostMicro.prototype.getContentElement = function( )
{
	return domutil.childByTagClass( this.element, null, PM_CONTENT_CLASS, _skipPostContent );
}

PostMicro.prototype.getPostMicro = function( element )
{
	if ( ! element.post )
		element.post = new PostMicro( this, element );
	return element.post;
}

