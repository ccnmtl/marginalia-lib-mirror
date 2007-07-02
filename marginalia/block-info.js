function parseBlockInfoXml( xmldoc )
{
	var listElement = xmldoc.documentElement;
	if ( listElement.tagName != 'blocks' )
		return null;
	
	var blockInfoArray = new Array();
	for ( var blockElement = listElement.firstChild;  blockElement;  blockElement = blockElement.nextSibling )
	{
		if ( ELEMENT_NODE == blockElement.nodeType && 'block' == blockElement.tagName )
		{
			var info = new AnnotatedBlockInfo( );
			info.fromXml( blockElement );
			blockInfoArray[ blockInfoArray.length ] = info;
		}
	}
	return blockInfoArray;
}

function AnnotatedBlockInfo( xpathBlock, sequenceBlock )
{
	this.users = new Array();
	this.xpathBlock = xpathBlock;
	this.sequenceBlock = sequenceBlock;
	this.url = null;
}

AnnotatedBlockInfo.prototype.fromXml = function( blockElement )
{
	this.xpathBlock = blockElement.getAttribute( 'xpath-block' );
	this.sequenceBlock = blockElement.getAttribute( 'sequence-block' );
	this.url = blockElement.getAttribute( 'url' );
	for ( var userElement = blockElement.firstChild;  userElement;  userElement = userElement.nextSibling )
	{
		if ( ELEMENT_NODE == userElement.nodeType && 'user' == userElement.tagName )
			this.users[ this.users.length ] = getNodeText( userElement );
	}
}

AnnotatedBlockInfo.prototype.resolveBlock = function( root )
{
	if ( this.xpathBlock )
	{
		var node = root.ownerDocument.evaluate( this.xpathBlock, root, null, XPathResult.ANY_TYPE, null );
		return node.iterateNext();
	}
	else
		return null;
}
