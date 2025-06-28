namespace Archaios.AI.DurableHandler.Config
{
    public class AuthSettings
    {
        public MicrosoftAuthSettings? Microsoft { get; set; }
        public GoogleAuthSettings? Google { get; set; }
    }

    public class MicrosoftAuthSettings
    {
        public string ClientId { get; set; } = string.Empty;
        public string TenantId { get; set; } = string.Empty;
        public string Instance { get; set; } = "https://login.microsoftonline.com/";
    }

    public class GoogleAuthSettings
    {
        public string ClientId { get; set; } = string.Empty;
    }
}
