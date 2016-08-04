use JSON::Parse qw(json_file_to_perl);
use Sereal qw(encode_sereal); 
use IO::Compress::Lzma qw(lzma $LzmaError);

my $data = json_file_to_perl('data.json');
my $encoded = encode_sereal($data);
my $status = lzma \$encoded => \$compressed
        or die "lzma failed: $LzmaError\n";

print "Sereal: ";
print length $encoded;
print "B; after LZMA: ";
print length $compressed;
print "B\n";
