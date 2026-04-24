class DataCollectionError(Exception):
    """Base exception for the data collection pipeline."""


class UnsupportedEventError(DataCollectionError):
    """Raised when the webhook payload is not supported by this pipeline."""


class InvalidWebhookSignatureError(DataCollectionError):
    """Raised when the webhook signature does not match Meta expectations."""


class MetaApiError(DataCollectionError):
    """Raised for generic Meta Graph API errors."""


class MetaPermissionError(MetaApiError):
    """Raised when the token lacks permission to access the requested object."""


class MetaRateLimitError(MetaApiError):
    """Raised when Meta rejects the request because of throttling or quotas."""

