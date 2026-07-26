package tn.sageindex.portal.auth;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import tn.sageindex.portal.account.UserAccount;
import tn.sageindex.portal.account.UserAccountRepository;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final UserAccountRepository repository;
    private final PasswordEncoder encoder;
    private final UserDetailsService users;
    public AuthController(AuthenticationManager authenticationManager,JwtService jwtService,
                          UserAccountRepository repository,PasswordEncoder encoder,UserDetailsService users){
        this.authenticationManager=authenticationManager;this.jwtService=jwtService;
        this.repository=repository;this.encoder=encoder;this.users=users;
    }

    @PostMapping("/login")
    public Map<String,Object> login(@Valid @RequestBody LoginRequest request){
        Authentication auth=authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.username(),request.password()));
        UserDetails user=users.loadUserByUsername(auth.getName());
        return Map.of("accessToken",jwtService.create(user),"tokenType","Bearer","expiresIn",28800);
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@RequestHeader("Authorization") String authorization){
        if(authorization.startsWith("Bearer "))jwtService.revoke(authorization.substring(7));
    }

    @PostMapping("/change-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(Authentication authentication,@Valid @RequestBody ChangePasswordRequest request){
        if(request.currentPassword().equals(request.newPassword()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Le nouveau mot de passe doit être différent");
        UserAccount account=repository.findByUsername(authentication.getName())
                .orElseThrow(()->new ResponseStatusException(HttpStatus.BAD_REQUEST,"Le compte administrateur se configure par l’environnement"));
        if(!encoder.matches(request.currentPassword(),account.getPasswordHash()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Mot de passe actuel incorrect");
        account.setPasswordHash(encoder.encode(request.newPassword()));
        repository.save(account);
        jwtService.revokeAll(authentication.getName());
    }

    public record LoginRequest(@NotBlank String username,@NotBlank String password){}
    public record ChangePasswordRequest(@NotBlank String currentPassword,
                                        @NotBlank @Size(min=8,max=128) String newPassword){}
}
